import cron from 'node-cron';
import { paymentService } from '../services/paymentService';
import { subscriptionService } from '../services/subscriptionService';
import { webhookService } from '../services/webhookService';
import { blockchainMonitorService } from '../services/blockchainMonitorService';
import { ofacService } from '../services/ofacService';

class PaymentScheduler {
  private jobs: cron.ScheduledTask[] = [];

  start(): void {
    console.log('[Scheduler] Starting payment scheduler...');

    const checkNewPaymentsJob = cron.schedule('* * * * *', async () => {
      try {
        await this.checkNewPaymentsToMonitor();
      } catch (error) {
        console.error('[Scheduler] Error checking new payments:', error);
      }
    });

    const expirePaymentsJob = cron.schedule('*/5 * * * *', async () => {
      try {
        const count = await paymentService.expireOldPayments();
        if (count > 0) {
          console.log(`[Scheduler] Expired ${count} payments`);
        }
      } catch (error) {
        console.error('[Scheduler] Error expiring payments:', error);
      }
    });

    const expireSubscriptionsJob = cron.schedule('0 * * * *', async () => {
      try {
        const count = await subscriptionService.checkAndExpireSubscriptions();
        if (count > 0) {
          console.log(`[Scheduler] Expired ${count} subscriptions`);
        }
      } catch (error) {
        console.error('[Scheduler] Error expiring subscriptions:', error);
      }
    });

    const retryWebhooksJob = cron.schedule('*/2 * * * *', async () => {
      try {
        const count = await webhookService.retryPendingWebhooks();
        if (count > 0) {
          console.log(`[Scheduler] Retried ${count} webhooks`);
        }
      } catch (error) {
        console.error('[Scheduler] Error retrying webhooks:', error);
      }
    });

    const ofacUpdateJob = cron.schedule('0 0 * * *', async () => {
      try {
        console.log('[Scheduler] Running daily OFAC list update...');
        const result = await ofacService.updateList();
        if (result.success) {
          console.log(`[Scheduler] OFAC update: ${result.totalAddresses} addresses (${result.newAddresses} new, ${result.removedAddresses} removed)`);
        } else {
          console.error('[Scheduler] OFAC update failed:', result.error);
        }
      } catch (error) {
        console.error('[Scheduler] Error updating OFAC list:', error);
      }
    });

    this.jobs.push(checkNewPaymentsJob, expirePaymentsJob, expireSubscriptionsJob, retryWebhooksJob, ofacUpdateJob);

    console.log('[Scheduler] Payment scheduler started with 5 jobs (including daily OFAC update at midnight UTC)');
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    console.log('[Scheduler] Payment scheduler stopped');
  }

  private async checkNewPaymentsToMonitor(): Promise<void> {
    const awaitingPayments = await paymentService.getAwaitingPayments();
    
    for (const payment of awaitingPayments) {
      if (!blockchainMonitorService.isInQueue(payment.id)) {
        blockchainMonitorService.addToQueue(payment.id);
      }
    }
  }
}

export const paymentScheduler = new PaymentScheduler();
