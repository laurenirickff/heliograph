export async function GET() {
  try {
    // simple dynamic check so the route is clearly working
    const now = new Date().toISOString();
    return new Response(`OK ${now}`, { status: 200 });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}


