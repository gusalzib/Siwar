// server/models/ProcessedWebhookEvent.ts
import mongoose, { Schema, type Document, type Model } from 'mongoose'
import type { PaymentProviderType } from '~/types/payment'

export interface IProcessedWebhookEvent extends Document {
  eventId: string
  provider: PaymentProviderType
  eventType: string
  orderReference?: string
  processedAt: Date
  rawPayload?: any
  createdAt: Date
  updatedAt: Date
}

const ProcessedWebhookEventSchema = new Schema<IProcessedWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['STRIPE', 'SWISH', 'KLARNA'],
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    orderReference: {
      type: String,
      index: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
)

export const ProcessedWebhookEvent =
  (mongoose.models.ProcessedWebhookEvent as Model<IProcessedWebhookEvent>) ||
  mongoose.model<IProcessedWebhookEvent>(
    'ProcessedWebhookEvent',
    ProcessedWebhookEventSchema
  )