import { Controller, Get, Req } from '@nestjs/common';
import Stripe from 'stripe';

@Controller('billing')
export class BillingController {
  @Get('portal-link')
  async getPortalLink(@Req() req) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    // You must have a way to look up the user's Stripe customer ID
    const customerId = req.user.stripeCustomerId; // or fetch from DB
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.BILLING_RETURN_URL || 'https://your-app.com/dashboard/settings',
    });
    return { url: session.url };
  }
} 