"use strict";

const crypto = require("crypto");
const db = require("../db");
const mailer = require("../email");

async function processCampaign(campaign) {
  await db.requeueMarketingRecipients(campaign.id);
  let recipient;
  while ((recipient = await db.claimMarketingRecipient(campaign.id))) {
    try {
      await mailer.sendMarketingCampaignRecipient(campaign.kind, campaign.snapshot, {
        email: recipient.email,
        firstname: recipient.firstname,
      });
      await db.finishMarketingRecipient(recipient.id, true);
    } catch (error) {
      await db.finishMarketingRecipient(recipient.id, false, error.message);
    }
  }
  return db.finishMarketingCampaign(campaign.id);
}

async function enqueueCampaign({ kind, sourceId, eventId, subject, snapshot, audience, createdBy }) {
  const recipients = await db.listCampaignRecipients(audience);
  if (!recipients.length) return { created: false, reason: "no_recipients" };
  const result = await db.createMarketingCampaign({
    id: crypto.randomUUID(), eventId, kind, sourceId, subject, snapshot, audience, createdBy,
  }, recipients);
  if (result.created) {
    setImmediate(() => processCampaign(result.campaign).catch((error) => {
      console.error("[marketing-campaign] processing failed:", error.message);
    }));
  }
  return result;
}

async function processQueuedCampaigns(limit) {
  const campaigns = await db.listQueuedMarketingCampaigns(limit);
  for (const campaign of campaigns) await processCampaign(campaign);
  return { campaigns: campaigns.length };
}

module.exports = { enqueueCampaign, processCampaign, processQueuedCampaigns };
