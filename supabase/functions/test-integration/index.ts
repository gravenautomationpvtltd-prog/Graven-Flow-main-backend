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

    const { integration_type, api_key, config, account_type, userid, profile_id } = await req.json();

    if (!integration_type) {
      return new Response(JSON.stringify({ error: 'integration_type is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let testResult = { success: false, message: '', details: {} };

    switch (integration_type) {
      case 'indiamart':
        testResult = await testIndiaMart(api_key);
        break;
      case 'whatsapp':
        testResult = await testWhatsApp(api_key, config);
        break;
      case 'justdial':
        testResult = await testJustDial(api_key);
        break;
      case 'tradeindia':
        testResult = await testTradeIndia(api_key, userid, profile_id, account_type);
        break;
      case 'email':
        testResult = await testEmail(config);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown integration type' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(testResult), {
      status: testResult.success ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in test-integration function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function testIndiaMart(apiKey: string): Promise<{ success: boolean; message: string; details: any }> {
  if (!apiKey) {
    return { success: false, message: 'API key is required', details: {} };
  }

  try {
    // Test IndiaMART CRM API with a simple request
    const response = await fetch(
      `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${apiKey}`,
      { method: 'GET' }
    );

    const data = await response.json();

    if (data.CODE === 200 || data.STATUS === 'SUCCESS') {
      return {
        success: true,
        message: 'IndiaMART connection successful',
        details: {
          leads_available: data.RESPONSE?.length || 0,
        }
      };
    } else {
      return {
        success: false,
        message: data.MESSAGE || 'Invalid API key or authentication failed',
        details: { code: data.CODE }
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      details: {}
    };
  }
}

async function testWhatsApp(apiKey: string, config: any): Promise<{ success: boolean; message: string; details: any }> {
  const provider = config?.provider || '360dialog';

  if (!apiKey) {
    return { success: false, message: 'API key is required', details: {} };
  }

  try {
    let endpoint = '';
    let headers: Record<string, string> = {};

    switch (provider) {
      case '360dialog':
        endpoint = 'https://waba.360dialog.io/v1/configs/webhook';
        headers = { 'D360-API-KEY': apiKey };
        break;
      case 'gupshup':
        endpoint = 'https://api.gupshup.io/sm/api/v1/users/me';
        headers = { 'apikey': apiKey };
        break;
      case 'wati':
        // Wati uses a different auth pattern
        endpoint = `https://live-server-${config?.region || '1'}.wati.io/api/v1/getContacts?pageSize=1`;
        headers = { 'Authorization': `Bearer ${apiKey}` };
        break;
      case 'aisensy':
        // AiSensy uses API key in request body for campaign API
        try {
          const aiSensyResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: apiKey,
              campaignName: 'test_connection',
              destination: '',
            })
          });
          // A valid API key returns specific validation errors vs 401 for invalid key
          if (aiSensyResponse.status !== 401) {
            return { success: true, message: 'AiSensy connection successful', details: { provider } };
          } else {
            return { success: false, message: 'Invalid API key', details: { provider } };
          }
        } catch (err: unknown) {
          return {
            success: false,
            message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            details: { provider }
          };
        }
      default:
        return { success: false, message: 'Unknown WhatsApp provider', details: {} };
    }

    const response = await fetch(endpoint, { 
      method: 'GET',
      headers 
    });

    if (response.ok) {
      return {
        success: true,
        message: `${provider} connection successful`,
        details: { provider }
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        message: `Authentication failed: ${response.status}`,
        details: { provider, error: errorText }
      };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      details: { provider }
    };
  }
}

async function testJustDial(apiKey: string): Promise<{ success: boolean; message: string; details: any }> {
  if (!apiKey) {
    return { success: false, message: 'API key is required', details: {} };
  }

  // JustDial uses webhook-based integration
  // We just validate the key format and return success
  // Actual validation happens when JustDial sends data
  return {
    success: true,
    message: 'JustDial webhook key configured. Leads will be received when JustDial sends them.',
    details: {
      webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/lead-webhook`,
      note: 'Configure this webhook URL in your JustDial dashboard'
    }
  };
}

async function testTradeIndia(
  apiKey: string,
  userid?: string,
  profileId?: string,
  accountType?: string
): Promise<{ success: boolean; message: string; details: any }> {
  // Trim all credentials to remove any leading/trailing spaces
  const trimmedApiKey = (apiKey || '').trim();
  const trimmedUserid = (userid || '').trim();
  const trimmedProfileId = (profileId || '').trim();

  if (!trimmedApiKey || !trimmedUserid || !trimmedProfileId) {
    return { 
      success: false, 
      message: 'User ID, Profile ID, and API Key are all required', 
      details: {} 
    };
  }

  try {
    // Determine API endpoint based on account type
    const baseUrl = accountType === 'buy_leads'
      ? 'https://www.tradeindia.com/utils/my_buy_leads.html'
      : 'https://www.tradeindia.com/utils/my_inquiry.html';

    const apiUrl = `${baseUrl}?userid=${trimmedUserid}&profile_id=${trimmedProfileId}&key=${trimmedApiKey}`;
    
    console.log(`Testing TradeIndia ${accountType || 'inquiry'} API...`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    
    // Check HTTP status
    if (!response.ok) {
      return {
        success: false,
        message: `TradeIndia API returned HTTP status ${response.status}`,
        details: { status: response.status }
      };
    }
    
    // Check if response is HTML (error page) instead of JSON
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    
    if (contentType.includes('text/html') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('TradeIndia returned HTML instead of JSON:', responseText.substring(0, 200));
      return {
        success: false,
        message: 'TradeIndia API returned an error page. Please verify your credentials (User ID, Profile ID, API Key) are correct.',
        details: { 
          hint: 'Check if there are any leading/trailing spaces in your credentials',
          received_html: true
        }
      };
    }
    
    // Try to parse JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse TradeIndia response:', responseText.substring(0, 200));
      return {
        success: false,
        message: 'TradeIndia API returned invalid response. Please verify your credentials.',
        details: { parse_error: true }
      };
    }

    // Check for API errors in the response
    if (data.STATUS === 'FAILURE' || data.error) {
      return {
        success: false,
        message: data.MESSAGE || data.error || 'TradeIndia API returned an error',
        details: { code: data.CODE }
      };
    }

    // Success - extract lead count
    const leads = data.data || data.RESPONSE || data.leads || [];
    
    return {
      success: true,
      message: `TradeIndia ${accountType === 'buy_leads' ? 'Buy Leads' : 'Inquiry'} API connection successful`,
      details: {
        leads_available: Array.isArray(leads) ? leads.length : 0,
        account_type: accountType || 'inquiry'
      }
    };
  } catch (err: unknown) {
    console.error('TradeIndia test error:', err);
    return {
      success: false,
      message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      details: {}
    };
  }
}

async function testEmail(config: any): Promise<{ success: boolean; message: string; details: any }> {
  // Email integration typically uses incoming email parsing
  // This is a placeholder for email service validation
  return {
    success: true,
    message: 'Email integration configured. Set up email forwarding to receive leads.',
    details: {
      forward_to: config?.forward_email || 'Configure email forwarding address',
      note: 'Forward inquiry emails to this address to auto-create leads'
    }
  };
}
