export async function GET() {
  const editable = process.env.EDIT_MODE !== 'false';
  return Response.json({ editable });
}
