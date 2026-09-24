import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ParsedProductData {
  product_name?: string;
  brand?: string;
  model_number?: string;
  specifications?: Record<string, string>;
  quantity?: number;
  unit?: string;
  dimensions?: string;
  material?: string;
  features?: string[];
  price_indication?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { attachmentId, fileUrl, fileName, fileType } = await req.json();

    if (!attachmentId || !fileUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Attachment ID and file URL are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update status to processing
    await supabase
      .from("enquiry_item_attachments")
      .update({ parsing_status: "processing", parsing_error: null })
      .eq("id", attachmentId);

    console.log(`Processing attachment: ${fileName} (${fileType})`);

    // Fetch the file content
    let fileContent = "";
    let isImage = false;
    let base64Image = "";

    const lowerFileName = fileName.toLowerCase();
    const isPdf = lowerFileName.endsWith(".pdf") || fileType?.includes("pdf");
    const isExcel = lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls") || 
                    lowerFileName.endsWith(".csv") || fileType?.includes("spreadsheet") || 
                    fileType?.includes("csv");
    const isImageFile = fileType?.startsWith("image/") || 
                        lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg") || 
                        lowerFileName.endsWith(".png") || lowerFileName.endsWith(".webp");

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }

      if (isImageFile) {
        isImage = true;
        const arrayBuffer = await response.arrayBuffer();
        base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      } else if (isPdf) {
        // For PDFs, we'll ask AI to extract what it can from the filename and context
        fileContent = `[PDF Document: ${fileName}]\nPlease analyze this PDF datasheet based on the filename and extract likely product details.`;
      } else if (isExcel) {
        // For CSV files, we can read as text
        if (lowerFileName.endsWith(".csv")) {
          fileContent = await response.text();
        } else {
          fileContent = `[Excel Document: ${fileName}]\nPlease analyze this Excel BOQ based on the filename and extract likely product details.`;
        }
      } else {
        // Try to read as text
        fileContent = await response.text();
      }
    } catch (fetchError) {
      console.error("Error fetching file:", fetchError);
      fileContent = `[File: ${fileName}]\nCould not fetch file content directly. Please extract product details based on the filename.`;
    }

    // Build the AI request
    const systemPrompt = `You are a product data extraction specialist for a procurement system. 
Your job is to extract structured product information from documents, datasheets, and BOQs (Bill of Quantities).

Extract the following information when available:
- product_name: The main product name
- brand: Manufacturer or brand name
- model_number: Model/Part number
- specifications: Key technical specifications as key-value pairs
- quantity: Number of items if mentioned
- unit: Unit of measurement (pcs, kg, m, etc.)
- dimensions: Size/dimensions if available
- material: Material composition
- features: Key features as a list
- price_indication: Any price or cost mentioned
- notes: Any other relevant information

Return ONLY valid JSON with the extracted data. If a field is not found, omit it.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    if (isImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract product details from this image (${fileName}). Return structured JSON with product information.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${fileType || "image/jpeg"};base64,${base64Image}`
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: `Extract product details from this document:\n\nFilename: ${fileName}\nFile type: ${fileType || "unknown"}\n\nContent:\n${fileContent.substring(0, 10000)}`
      });
    }

    console.log("Calling AI gateway for extraction...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);

      if (aiResponse.status === 429) {
        await supabase
          .from("enquiry_item_attachments")
          .update({ parsing_status: "failed", parsing_error: "Rate limit exceeded. Try again later." })
          .eq("id", attachmentId);
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (aiResponse.status === 402) {
        await supabase
          .from("enquiry_item_attachments")
          .update({ parsing_status: "failed", parsing_error: "AI credits exhausted." })
          .eq("id", attachmentId);
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    console.log("AI response received, parsing JSON...");

    // Extract JSON from the response
    let parsedData: ParsedProductData = {};
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      parsedData = { notes: content };
    }

    // Update the attachment with parsed data
    const { error: updateError } = await supabase
      .from("enquiry_item_attachments")
      .update({
        parsed_data: parsedData,
        parsing_status: "completed",
        parsing_error: null,
      })
      .eq("id", attachmentId);

    if (updateError) {
      console.error("Failed to update attachment:", updateError);
      throw updateError;
    }

    console.log("Parsing completed successfully");

    return new Response(
      JSON.stringify({ success: true, data: parsedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error parsing attachment:", error);
    
    // Try to update the attachment status to failed
    try {
      const { attachmentId } = await req.clone().json();
      if (attachmentId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase
          .from("enquiry_item_attachments")
          .update({ 
            parsing_status: "failed", 
            parsing_error: error instanceof Error ? error.message : "Unknown error" 
          })
          .eq("id", attachmentId);
      }
    } catch (e) {
      console.error("Failed to update error status:", e);
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
