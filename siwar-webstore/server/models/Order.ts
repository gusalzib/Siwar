// server/models/Order.ts
import mongoose, { Schema, type Document, type Model } from 'mongoose'
import type { PaymentProviderType } from '~/types/payment'

export type OrderPaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIALLY_CAPTURED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'


export type OrderFulfillmentStatus =
  | 'PENDING_PACKING'
  | 'PACKED'
  | 'DISPATCHED'
  | 'CANCELLED'

export type LineItemShortageStatus =
  | 'NONE'
  | 'REDUCED'
  | 'REMOVED'
  | 'SUBSTITUTED'

export interface IShortageAdjustment {
  timestamp: Date
  /**
   * We do not yet have different types of users; we only have one admin account. 
   * If the client decides to pay for the extra feature of having multiple account like staff/admin etc..
   * then we can implement the feature. So even though the performedBy attribute is here, it is not used for now. 
   * We can give the 'Admin' default value. 
   */
  performedBy?: string // Admin/staff user ID or identifier
  productId: mongoose.Types.ObjectId
  action: 'REDUCE_QUANTITY' | 'REMOVE_LINE' | 'SUBSTITUTE_ITEM'
  originalQuantity: number
  adjustedQuantity: number
  originalUnitPriceMinor: number
  substitutedProductId?: mongoose.Types.ObjectId
  substitutedSku?: string
  substitutedUnitPriceMinor?: number
  note?: string
}
export interface IOrderItem {
  productId: mongoose.Types.ObjectId
  sku?: string
  name: {
    ar: string
    sv: string
    en: string
  }
  quantity: number
  fulfilledQuantity: number // Actually picked and packed quantity
  unitPriceMinor: number
  momsRate: 12 | 25
  shortageStatus: LineItemShortageStatus
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
  authorizedTotalMinor: number // Initial hold amount
  capturedTotalMinor?: number // Final settled total after packing
  releasedOrRefundedMinor?: number // Amount released (Stripe) or refunded (Swish)
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
  fulfillmentStatus: OrderFulfillmentStatus
  currency: 'SEK' | 'EUR' | 'USD'
  customer: IOrderCustomer
  items: IOrderItem[]
  shortageAdjustments: IShortageAdjustment[]
  pricing: IOrderPricing
  inventoryDecremented: boolean
  authorizedAt?: Date
  paidAt?: Date
  packedAt?: Date
  dispatchedAt?: Date
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
    fulfilledQuantity: { type: Number, required: true, min: 0 },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    momsRate: { type: Number, required: true, enum: [12, 25] },
    shortageStatus: {
      type: String,
      enum: ['NONE', 'REDUCED', 'REMOVED', 'SUBSTITUTED'],
      default: 'NONE',
    },
  },
  { _id: false }
)

const ShortageAdjustmentSchema = new Schema<IShortageAdjustment>(
  {
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: String },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    action: {
      type: String,
      required: true,
      enum: ['REDUCE_QUANTITY', 'REMOVE_LINE', 'SUBSTITUTE_ITEM'],
    },
    originalQuantity: { type: Number, required: true },
    adjustedQuantity: { type: Number, required: true },
    originalUnitPriceMinor: { type: Number, required: true },
    substitutedProductId: { type: Schema.Types.ObjectId, ref: 'Product' },
    substitutedSku: { type: String },
    substitutedUnitPriceMinor: { type: Number },
    note: { type: String },
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
      enum: [
        'PENDING',
        'AUTHORIZED',
        'PAID',
        'PARTIALLY_CAPTURED',
        'CAPTURED',
        'FAILED',
        'CANCELLED',
      ],
      default: 'PENDING',
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      required: true,
      enum: ['PENDING_PACKING', 'PACKED', 'DISPATCHED', 'CANCELLED'],
      default: 'PENDING_PACKING',
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
    shortageAdjustments: { type: [ShortageAdjustmentSchema], default: [] },
    pricing: {
      itemsTotalMinor: { type: Number, required: true },
      shippingFeeMinor: { type: Number, required: true },
      grandTotalMinor: { type: Number, required: true },
      authorizedTotalMinor: { type: Number, required: true },
      capturedTotalMinor: { type: Number },
      releasedOrRefundedMinor: { type: Number, default: 0 },
      taxSplit: { type: Schema.Types.Mixed, required: true },
    },
    inventoryDecremented: { type: Boolean, default: false },
    authorizedAt: { type: Date },
    paidAt: { type: Date },
    packedAt: { type: Date },
    dispatchedAt: { type: Date },
  },
  {
    timestamps: true,
  }
)

export const Order = (mongoose.models.Order as Model<IOrder>) || mongoose.model<IOrder>('Order', OrderSchema)