import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { destination, templateName, templateParams, leadId, userId } = await req.json();

    if (!destination || !templateName) {
      return new Response(JSON.stringify({ 
        error: 'destination and templateName are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get WhatsApp integration settings
    const { data: settings, error: settingsError } = await supabase
      .from('integration_settings')
      .select('*')
      .eq('integration_type', 'whatsapp')
      .single();

    if (settingsError || !settings?.is_enabled) {
      return new Response(JSON.stringify({ 
        error: 'WhatsApp integration not enabled' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.api_key) {
      return new Response(JSON.stringify({ 
        error: 'WhatsApp API key not configured' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const provider = settings.config?.provider || '360dialog';
    let response: Response;
    let result: any;

    // Clean phone number - ensure it has country code
    const cleanPhone = destination.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    console.log(`Sending WhatsApp via ${provider} to ${phoneWithCountry}`);

    if (provider === 'aisensy') {
      // AiSensy Campaign API
      response = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: settings.api_key,
          campaignName: templateName,
          destination: phoneWithCountry,
          userName: templateParams?.userName || 'Customer',
          templateParams: templateParams?.params || [],
          source: 'CRM',
          media: templateParams?.media || {},
          buttons: templateParams?.buttons || [],
          carouselCards: templateParams?.carouselCards || [],
          location: templateParams?.location || {},
          paramsFallbackValue: templateParams?.fallbackValues || {},
        })
      });

      result = await response.json();
      console.log('AiSensy response:', JSON.stringify(result));

      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Failed to send WhatsApp message');
      }

    } else if (provider === '360dialog') {
      // 360Dialog API
      response = await fetch('https://waba.360dialog.io/v1/messages', {
        method: 'POST',
        headers: {
          'D360-API-KEY': settings.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phoneWithCountry,
          type: 'template',
          template: {
            namespace: settings.config?.namespace || '',
            name: templateName,
            language: { code: 'en' },
            components: templateParams?.components || [],
          }
        })
      });

      result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to send WhatsApp message');
      }

    } else if (provider === 'gupshup') {
      // Gupshup API
      const formData = new URLSearchParams();
      formData.append('channel', 'whatsapp');
      formData.append('source', settings.config?.sourcePhone || '');
      formData.append('destination', phoneWithCountry);
      formData.append('src.name', settings.config?.appName || '');
      formData.append('template', JSON.stringify({
        id: templateName,
        params: templateParams?.params || [],
      }));

      response = await fetch('https://api.gupshup.io/sm/api/v1/template/msg', {
        method: 'POST',
        headers: {
          'apikey': settings.api_key,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      result = await response.json();
      if (!response.ok || result.status === 'error') {
        throw new Error(result.message || 'Failed to send WhatsApp message');
      }

    } else if (provider === 'wati') {
      // Wati API
      const region = settings.config?.region || '1';
      response = await fetch(
        `https://live-server-${region}.wati.io/api/v1/sendTemplateMessage?whatsappNumber=${phoneWithCountry}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            template_name: templateName,
            broadcast_name: 'CRM_Outreach',
            parameters: templateParams?.params?.map((p: string, i: number) => ({
              name: `${i + 1}`,
              value: p
            })) || [],
          })
        }
      );

      result = await response.json();
      if (!response.ok || !result.result) {
        throw new Error(result.message || 'Failed to send WhatsApp message');
      }

    } else {
      return new Response(JSON.stringify({ 
        error: `Unsupported provider: ${provider}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log activity if leadId is provided
    if (leadId && userId) {
      await supabase
        .from('activities')
        .insert({
          lead_id: leadId,
          user_id: userId,
          activity_type: 'whatsapp_sent',
          description: `WhatsApp template "${templateName}" sent`,
          metadata: {
            destination: phoneWithCountry,
            template: templateName,
            provider: provider,
            response: result,
          }
        });

      // Update lead's last_activity_at
      await supabase
        .from('leads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', leadId);
    }

    // Log the send
    await supabase
      .from('integration_logs')
      .insert({
        integration_type: 'whatsapp',
        status: 'success',
        metadata: {
          action: 'send_message',
          destination: phoneWithCountry,
          template: templateName,
          provider: provider,
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'WhatsApp message sent successfully',
      result,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in send-whatsapp function:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
