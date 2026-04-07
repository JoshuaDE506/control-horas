//test-email/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  try {
    const result = await resend.emails.send({
      from: 'CodigoFacil <onboarding@resend.dev>',
      to: 'TU_CORREO@gmail.com',
      subject: 'Prueba Resend',
      html: '<h1>Resend funciona</h1>',
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('RESEND ERROR:', error);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
