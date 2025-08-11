# VideoToPrompt

## Vision
Transform video walkthroughs into structured prompts for n8n AI agents. Users upload a screen recording with narration, select their automation platform, and receive a ready-to-use prompt.

## Core Flow
1. Upload video (3-4 minutes, with audio narration)
2. Select output format (Browser-Use MCP or AirTop)
3. Receive formatted prompt
4. Copy to clipboard → Paste into n8n/Langfuse

## Tech Stack
- Next.js 14 (App Router)
- Google Gemini 2.5 Flash API
- Tailwind CSS + shadcn/ui
- react-dropzone

## Project Structure
```
video-to-prompt/
├── app/
│   ├── page.tsx              # Main interface
│   ├── api/
│   │   ├── healthcheck/      # Health check endpoint
│   │   └── analyze/          # Video processing endpoint
│   └── layout.tsx
├── components/
│   ├── upload-zone.tsx       # Video upload (500MB max)
│   ├── processing-view.tsx   # Progress display
│   └── prompt-output.tsx     # Result display with copy
├── lib/
│   ├── gemini.ts            # Gemini client and processing
│   └── templates.ts         # Output formatters
└── .env.local              # GOOGLE_AI_API_KEY
```

## Dev runbook

### Clean restart and start

```bash
# Kill anything on 3000 and any lingering Next dev processes
(lsof -ti tcp:3000 || true) | xargs -r kill -9; pkill -f "next dev" || true; pkill -f "/node .*next" || true

# Start dev server
npm run dev
```

- If port 3000 is in use, Next.js will automatically use the next available port (e.g., 3001). Use the URL printed by Next.js.
- To force a specific port: `PORT=3001 npm run dev`.

### Healthcheck

```bash
curl -sSf http://localhost:3000/api/healthcheck
```

### Activity log SSE (dev diagnostics)

```bash
# Stream first lines to verify
curl -sN http://localhost:3000/api/logs/test-run/stream | head -n 10 | cat

# Emit a test event (dev-only)
curl -s -X POST "http://localhost:3000/api/logs/test-run/emit" \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "generators",
    "type": "start",
    "message": "dev emit test",
    "data": { "N": 3, "model": "gemini-2.5-flash", "generators": ["strict", "flex", "shadow"] }
  }'
```

### Environment

- Create `.env.local` with `GEMINI_API_KEY=...` (required for video analysis).
- The Gemini client is initialized at runtime; missing keys will error when an analysis call is made.

## Implementation

### 1. Video Analysis (`lib/gemini.ts`)
```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  generationConfig: { temperature: 0.2 }
});

export async function analyzeVideo(videoFile: File) {
  // Upload to Gemini File API
  const uploadResult = await fileManager.uploadFile(videoFile);
  
  // Wait for processing
  let file = await fileManager.getFile(uploadResult.file.name);
  while (file.state === "PROCESSING") {
    await sleep(5000);
    file = await fileManager.getFile(uploadResult.file.name);
  }
  
  // Analyze
  const result = await model.generateContent([
    { fileData: { fileUri: file.uri, mimeType: file.mimeType }},
    { text: EXTRACTION_PROMPT }
  ]);
  
  return JSON.parse(result.response.text());
}

const EXTRACTION_PROMPT = `
Extract browser automation steps from this workflow video.
Use both visual actions and audio narration.

For each step, identify:
- action: navigate|click|type|wait|verify|conditional
- target: specific element description
- value: text input or URL if applicable
- context: narrator's explanation
- waitFor: what confirms success

Output as JSON array in chronological order.
`;
```

### 2. Output Templates (`lib/templates.ts`)

#### Browser-Use MCP Format (Natural Language AI Agent)
```typescript
function formatBrowserUse(actions: Action[]): string {
  const intro = `You are automating a workflow in our web application. Follow these steps carefully:\n\n`;
  
  const steps = actions.map((action, i) => {
    const num = i + 1;
    let instruction = '';
    
    // Build natural language instruction with context
    switch(action.action) {
      case 'navigate':
        instruction = `${num}. Navigate to ${action.value}. ${action.narrationContext ? `Context: ${action.narrationContext}.` : ''}`;
        break;
        
      case 'click':
        instruction = `${num}. Find and click on the "${action.target.description}". ` +
          `This is typically located in the ${action.target.visualContext}. ` +
          `${action.narrationContext ? `Note: ${action.narrationContext}.` : ''}`;
        break;
        
      case 'type':
        instruction = `${num}. In the ${action.target.description} field, ` +
          `${action.target.visualContext ? `(located in ${action.target.visualContext}), ` : ''}` +
          `carefully type "${action.value}" exactly as shown. ` +
          `${action.businessLogic ? action.businessLogic + '.' : ''}`;
        break;
        
      case 'wait':
        instruction = `${num}. Wait for ${action.waitCondition.description}. ` +
          `You should see ${action.waitCondition.visualCue}. ` +
          `Do not proceed until this validation is complete.`;
        break;
        
      case 'verify':
        instruction = `${num}. Verify that ${action.target.description}. ` +
          `${action.waitCondition ? `Look for: ${action.waitCondition.visualCue}.` : ''}`;
        break;
    }
    
    // Add wait condition if present
    if (action.waitCondition && action.action !== 'wait') {
      instruction += ` After this action, wait for ${action.waitCondition.description}.`;
    }
    
    return instruction;
  }).join('\n\n');
  
  const errorHandling = `\n\nImportant: If any step fails or shows an error (red text, error message, or unexpected behavior), stop and report the specific error message and which step failed.`;
  
  return intro + steps + errorHandling;
}
```

#### AirTop Format (Tool-based Automation)
```typescript
function formatAirTop(actions: Action[]): string {
  const metadata = actions[0].narrationContext ? 
    `# Task Context\n${actions[0].narrationContext}\n\n---\n` : '';
  
  const steps = actions.map(action => {
    const lines = [`action: ${action.action}`];
    
    // Add targeting information
    if (action.target?.possibleSelectors?.length > 0) {
      lines.push(`selector: ${action.target.possibleSelectors.join(', ')}`);
      lines.push(`fallback: ${action.target.description}`);
    }
    
    // Add action-specific parameters
    if (action.value) {
      if (action.action === 'navigate') {
        lines.push(`url: ${action.value}`);
      } else if (action.action === 'type') {
        lines.push(`value: ${action.value}`);
        lines.push(`clear_first: true`);
      } else if (action.action === 'select') {
        lines.push(`option: ${action.value}`);
      }
    }
    
    // Add wait conditions
    if (action.waitCondition) {
      lines.push(`wait_for: ${action.waitCondition.visualCue || action.waitCondition.description}`);
      lines.push(`timeout: ${action.action === 'wait' ? '10000' : '5000'}`);
    }
    
    // Add business context as comment
    if (action.businessLogic) {
      lines.push(`# ${action.businessLogic}`);
    }
    
    return lines.join('\n');
  }).join('\n---\n');
  
  return metadata + steps;
}
```

### 3. API Endpoint (`app/api/analyze/route.ts`)
```typescript
export async function POST(request: Request) {
  const formData = await request.formData();
  const video = formData.get('video') as File;
  const template = formData.get('template') as string;
  
  // Process video
  const actions = await analyzeVideo(video);
  
  // Format output
  const prompt = template === 'browser-use' 
    ? formatBrowserUse(actions)
    : formatAirTop(actions);
  
  return Response.json({ prompt });
}
```

### 4. Main Interface (`app/page.tsx`)
```typescript
export default function Home() {
  const [template, setTemplate] = useState<'browser-use' | 'airtop'>('browser-use');
  const [state, setState] = useState<'idle' | 'uploading' | 'processing' | 'complete'>('idle');
  const [prompt, setPrompt] = useState('');
  
  const handleUpload = async (file: File) => {
    setState('uploading');
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('template', template);
    
    setState('processing');
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    const { prompt } = await response.json();
    setPrompt(prompt);
    setState('complete');
  };
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1>VideoToPrompt</h1>
      
      {/* Template selector */}
      <TemplateSelector value={template} onChange={setTemplate} />
      
      {/* Upload zone */}
      {state === 'idle' && <UploadZone onUpload={handleUpload} />}
      
      {/* Processing */}
      {state === 'processing' && <ProcessingView />}
      
      {/* Results */}
      {state === 'complete' && <PromptOutput prompt={prompt} />}
    </div>
  );
}
```

### 5. Components

#### Upload Zone
- Drag-and-drop or click to browse
- Accept: MP4, MOV, WebM
- Max size: 500MB
- Show file preview with duration

#### Processing View
- Animated progress indicator
- Status text: "Analyzing workflow..."

#### Prompt Output
- Syntax-highlighted result
- Copy to clipboard button
- Download as .txt option

## Setup

```bash
# Install
npx create-next-app@latest video-to-prompt --typescript --tailwind --app
cd video-to-prompt
git branch -m main master
npm install @google/generative-ai react-dropzone lucide-react
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card textarea toast

# Configure
echo "GOOGLE_AI_API_KEY=your_key" > .env.local

# Run
npm run dev
```

## Requirements

### Functional
- Process 3-4 minute videos with audio
- Generate n8n-ready prompts
- Support Browser-Use and AirTop formats
- One-click copy to clipboard

### Technical
- Health check at `/api/healthcheck` returning 200
- Master branch (not main)
- Local development with `npm run dev`
- No external dependencies beyond Gemini API

### Performance
- < 60 seconds processing time
- Minimal UI, maximum clarity
- Error recovery with retries

## Example Output

**Input**: Video showing solar permit creation in CRM with narration:
*"I need to create a permit for our customer John Smith at 123 Main Street. First going to our CRM... clicking New Permit... selecting Residential Solar because this is a standard rooftop installation... entering the address... waiting for it to validate against our service territory... good, it's validated. Now I'll add the system size - this is a 7.2kW system... and generate the permit."*

**Browser-Use MCP Output** (Natural language for AI agent with browser control):
```
You are creating a solar permit for a residential customer. Follow these steps:

1. Navigate to the CRM dashboard. Look for the main CRM application interface.

2. Find and click on the "New Permit" button. This is typically located in the top navigation bar or as a prominent button on the dashboard.

3. When the permit form opens, locate the "Permit Type" dropdown menu and select "Residential Solar" from the available options.

4. In the address field (usually labeled "Installation Address" or "Customer Address"), carefully type "123 Main Street" exactly as shown.

5. After entering the address, wait for the address validation to complete. You should see either a green checkmark, a "Validated" message, or the address field border turning green. This confirms the address is in our service territory. Do not proceed until you see this validation indicator.

6. Find the "System Size" field (may be labeled "System Size (kW)" or "DC System Size") and enter "7.2" as the value.

7. Locate and click the "Generate Permit" button. This is typically a primary action button at the bottom of the form, possibly blue or green in color.

8. Wait for the permit PDF to appear. You should see either a PDF preview pane open on the right side of the screen, a new tab open with the PDF, or a download notification. The permit is successfully created when you can see the PDF document.

Important: If any field shows an error (red text or red border), stop and report the specific error message. Common issues include invalid addresses or missing required fields.
```

**AirTop Output** (Deterministic tool-based approach):
```
task: Create residential solar permit
customer: John Smith
address: 123 Main Street
system_size: 7.2kW

---
action: navigate
url: ${CRM_BASE_URL}/dashboard
wait_for: element[data-page="dashboard"]
timeout: 10000

---
action: click
selector: button:has-text("New Permit"), [data-action="create-permit"], #new-permit-btn
wait_after: element[data-form="permit-creation"]
timeout: 5000

---
action: select
selector: select#permit-type, [name="permitType"], [data-field="permit-type"]
value: Residential Solar
wait_after: 500

---
action: type
selector: input[name="address"], #installation-address, [data-field="customer-address"]
value: 123 Main Street
clear_first: true

---
action: wait
condition: element[data-validation="address-valid"], .address-validated, .validation-success
timeout: 8000
error_if_not_found: Address validation failed - location may not be in service territory

---
action: type
selector: input[name="systemSize"], #system-size-kw, [data-field="system-size"]
value: 7.2
clear_first: true

---
action: click
selector: button[type="submit"]:has-text("Generate Permit"), #generate-permit, [data-action="generate"]
wait_after: element.pdf-viewer, element[data-content="permit-pdf"]
timeout: 15000

---
action: verify
condition: element:has-text("Permit Generated Successfully"), .pdf-preview:visible, [data-status="complete"]
screenshot: true
```

## Success Criteria
- Prompts work in n8n without modification (85%+ success rate)
- Processing under 60 seconds
- Users save 10+ minutes per workflow documentation