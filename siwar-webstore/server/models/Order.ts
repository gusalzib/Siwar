// server/models/Order.ts
import mongoose, { Schema, type Document, type Model } from 'mongoose'
import type { PaymentProviderType } from '~/types/payment'

export type OrderPaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'

export interface IOrderItem {
  productId: mongoose.Types.ObjectId
  sku?: string
  name: {
    ar: string
    sv: string
    en: string
  }
  quantity: number
  unitPriceMinor: number
  momsRate: 12 | 25
}

export interface IOrderCustomer {
  fullName: string
  email: string
  phone: string
  fulfillmentMethod: 'DELIVERY' | 'PICKUP'
  address?: {
    street: string
    postalCode: string
    city: string
  } | null
}

export interface IOrderPricing {
  itemsTotalMinor: number
  shippingFeeMinor: number
  grandTotalMinor: number
  taxSplit: {
    totalMomsMinor: number
    moms12: {
      netAmountMinor: number
      momsAmountMinor: number
    }
    moms25: {
      netAmountMinor: number
      momsAmountMinor: number
    }
  }
}

export interface IOrder extends Document {
  orderReference: string
  idempotencyKey: string
  paymentProvider: PaymentProviderType
  paymentId?: string
  paymentStatus: OrderPaymentStatus
  currency: 'SEK' | 'EUR' | 'USD'
  customer: IOrderCustomer
  items: IOrderItem[]
  pricing: IOrderPricing
  inventoryDecremented: boolean
  authorizedAt?: Date
  paidAt?: Date
  createdAt: Date
  updatedAt: Date
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String },
    name: {
      ar: { type: String, required: true },
      sv: { type: String, required: true },
      en: { type: String, required: true },
    },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    momsRate: { type: Number, required: true, enum: [12, 25] },
  },
  { _id: false }
)

const OrderSchema = new Schema<IOrder>(
  {
    orderReference: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, required: true, unique: true },
    paymentProvider: {
      type: String,
      required: true,
      enum: ['STRIPE', 'SWISH', 'KLARNA'],
    },
    paymentId: { type: String, sparse: true, index: true },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    currency: {
      type: String,
      required: true,
      enum: ['SEK', 'EUR', 'USD'],
    },
    customer: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      fulfillmentMethod: {
        type: String,
        required: true,
        enum: ['DELIVERY', 'PICKUP'],
      },
      address: {
        street: { type: String },
        postalCode: { type: String },
        city: { type: String },
      },
    },
    items: { type: [OrderItemSchema], required: true },
    pricing: {
      itemsTotalMinor: { type: Number, required: true },
      shippingFeeMinor: { type: Number, required: true },
      grandTotalMinor: { type: Number, required: true },
      taxSplit: { type: Schema.Types.Mixed, required: true },
    },
    inventoryDecremented: { type: Boolean, default: false },
    authorizedAt: { type: Date },
    paidAt: { type: Date },
  },
  {
    timestamps: true,
  }
)

export const Order = (mongoose.models.Order as Model<IOrder>) || mongoose.model<IOrder>('Order', OrderSchema)