// server/models/StoreSettings.ts
import mongoose, { Schema, model, type Document, type Types } from 'mongoose'

export interface IBanner {
  _id?: Types.ObjectId
  id?: string
  title: { ar: string; sv: string; en: string }
  subtitle: { ar: string; sv: string; en: string }
  badge?: { ar?: string; sv?: string; en?: string }
  imageUrl: string
  mobileImageUrl?: string
  linkUrl: string
  sortOrder: number
  isActive: boolean
  startsAt?: Date | null
  expiresAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface IShippingTier {
  maxWeightGrams: number // e.g., 3000, 7000, or null/Infinity for final tier
  feeMinorSEK: number    // e.g., 7700 (77.00 SEK)
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

export interface IDaySchedule {
  day: DayOfWeek
  isOpen: boolean
  openTime: string  // 'HH:mm', e.g. '10:00'
  closeTime: string // 'HH:mm', e.g. '18:00'
}

export interface IPickupSettings {
  enabled: boolean
  address: {
    street: string
    postalCode: string
    city: string
    country: string
  }
  schedule: IDaySchedule[]
  pickupHours?: {
    ar?: string
    sv?: string
    en?: string
  }
  instructions: {
    ar: string
    sv: string
    en: string
  }
}

export interface IStoreSettings {
  shipping: {
    freeShippingThresholdMinorSEK: number // e.g., 89900 (899.00 SEK)
    deliveryDays: {
      min: number // e.g., 1
      max: number // e.g., 3
    }
    tiers: IShippingTier[]
  }
  inventory: {
    defaultGlobalSafetyBuffer: number // Fallback buffer (e.g., 3 or 5)
  }
  pickup: IPickupSettings
  banners: IBanner[]
  updatedAt: Date
}

export const DEFAULT_WEEKLY_SCHEDULE: IDaySchedule[] = [
  { day: 'monday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'tuesday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'wednesday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'thursday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'friday', isOpen: true, openTime: '10:00', closeTime: '18:00' },
  { day: 'saturday', isOpen: true, openTime: '11:00', closeTime: '15:00' },
  { day: 'sunday', isOpen: false, openTime: '10:00', closeTime: '18:00' },
]

export const DAY_LABELS: Record<'ar' | 'sv' | 'en', Record<DayOfWeek, string>> = {
  sv: {
    monday: 'Måndag',
    tuesday: 'Tisdag',
    wednesday: 'Onsdag',
    thursday: 'Torsdag',
    friday: 'Fredag',
    saturday: 'Lördag',
    sunday: 'Söndag',
  },
  ar: {
    monday: 'الإثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة',
    saturday: 'السبت',
    sunday: 'الأحد',
  },
  en: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
}

export const CLOSED_LABEL: Record<'ar' | 'sv' | 'en', string> = {
  sv: 'Stängt',
  ar: 'مغلق',
  en: 'Closed',
}

/**
 * Normalizes any incoming schedule to guarantee all 7 days of the week
 * in strict Monday -> Sunday order with valid defaults.
 */
export function normalizeSchedule(inputSchedule?: any[]): IDaySchedule[] {
  const daysOrder: DayOfWeek[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]

  if (!Array.isArray(inputSchedule) || inputSchedule.length === 0) {
    return DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d }))
  }

  return daysOrder.map((day) => {
    const existing = inputSchedule.find((s) => s?.day === day)
    const defaultDay = DEFAULT_WEEKLY_SCHEDULE.find((d) => d.day === day)!

    if (!existing) {
      return { ...defaultDay }
    }

    return {
      day,
      isOpen: typeof existing.isOpen === 'boolean' ? existing.isOpen : defaultDay.isOpen,
      openTime: existing.openTime || defaultDay.openTime,
      closeTime: existing.closeTime || defaultDay.closeTime,
    }
  })
}

/**
 * Groups consecutive days with identical opening hours/status and produces
 * human-readable, localized schedule text.
 * Example output:
 * "Måndag - Fredag: 10:00 - 18:00 | Lördag: 11:00 - 15:00 | Söndag: Stängt"
 */
export function formatWeeklySchedule(
  schedule: IDaySchedule[],
  locale: 'ar' | 'sv' | 'en' = 'sv'
): string {
  const normalized = normalizeSchedule(schedule)

  interface ScheduleGroup {
    startDay: DayOfWeek
    endDay: DayOfWeek
    isOpen: boolean
    timeSignature: string
  }

  const groups: ScheduleGroup[] = []

  for (const item of normalized) {
    const timeSig = item.isOpen ? `${item.openTime} - ${item.closeTime}` : 'CLOSED'
    const lastGroup = groups[groups.length - 1]

    if (lastGroup && lastGroup.isOpen === item.isOpen && lastGroup.timeSignature === timeSig) {
      lastGroup.endDay = item.day
    } else {
      groups.push({
        startDay: item.day,
        endDay: item.day,
        isOpen: item.isOpen,
        timeSignature: timeSig,
      })
    }
  }

  const parts = groups.map((g) => {
    const startName = DAY_LABELS[locale][g.startDay]
    const endName = DAY_LABELS[locale][g.endDay]
    const dayLabel = g.startDay === g.endDay ? startName : `${startName} - ${endName}`
    const timeLabel = g.isOpen ? g.timeSignature : CLOSED_LABEL[locale]

    return `${dayLabel}: ${timeLabel}`
  })

  return parts.join(' | ')
}

export const DEFAULT_PICKUP_CONFIG: IPickupSettings = {
  enabled: true,
  address: {
    street: 'Storgatan 12',
    postalCode: '302 43',
    city: 'Halmstad',
    country: 'Sverige',
  },
  schedule: DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
  pickupHours: {
    ar: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'ar'),
    sv: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'sv'),
    en: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'en'),
  },
  instructions: {
    ar: 'يرجى إبراز رقم الطلب وتأكيد الهوية عند الاستلام في المتجر.',
    sv: 'Vänligen visa upp ditt ordernummer och giltig legitimation vid utlämning i butiken.',
    en: 'Please present your order reference number and a valid ID at the store counter upon collection.',
  },
}

const ShippingTierSchema = new Schema<IShippingTier>(
  {
    maxWeightGrams: { type: Number, required: true },
    feeMinorSEK: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const DayScheduleSchema = new Schema<IDaySchedule>(
  {
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: '10:00' },
    closeTime: { type: String, default: '18:00' },
  },
  { _id: false }
)

const PickupSchema = new Schema<IPickupSettings>(
  {
    enabled: { type: Boolean, default: true },
    address: {
      street: { type: String, default: 'Storgatan 12' },
      postalCode: { type: String, default: '302 43' },
      city: { type: String, default: 'Halmstad' },
      country: { type: String, default: 'Sverige' },
    },
    schedule: {
      type: [DayScheduleSchema],
      default: () => DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
    },
    pickupHours: {
      ar: { type: String },
      sv: { type: String },
      en: { type: String },
    },
    instructions: {
      ar: {
        type: String,
        default: 'يرجى إبراز رقم الطلب وتأكيد الهوية عند الاستلام في المتجر.',
      },
      sv: {
        type: String,
        default: 'Vänligen visa upp ditt ordernummer och giltig legitimation vid utlämning i butiken.',
      },
      en: {
        type: String,
        default: 'Please present your order reference number and a valid ID at the store counter upon collection.',
      },
    },
  },
  { _id: false }
)

const BannerSchema = new Schema<IBanner>(
  {
    title: {
      ar: { type: String, required: true },
      sv: { type: String, required: true },
      en: { type: String, required: true },
    },
    subtitle: {
      ar: { type: String, required: true },
      sv: { type: String, required: true },
      en: { type: String, required: true },
    },
    badge: {
      ar: { type: String, default: '' },
      sv: { type: String, default: '' },
      en: { type: String, default: '' },
    },
    imageUrl: { type: String, required: true },
    mobileImageUrl: { type: String, default: '' },
    linkUrl: { type: String, required: true, default: '/catalog' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const StoreSettingsSchema = new Schema<IStoreSettings>(
  {
    shipping: {
      freeShippingThresholdMinorSEK: { type: Number, default: 89900 },
      deliveryDays: {
        min: { type: Number, default: 1 },
        max: { type: Number, default: 3 },
      },
      tiers: {
        type: [ShippingTierSchema],
        default: [
          { maxWeightGrams: 3000, feeMinorSEK: 7700 },
          { maxWeightGrams: 7000, feeMinorSEK: 8900 },
          { maxWeightGrams: 9999999, feeMinorSEK: 10900 },
        ],
      },
    },
    inventory: {
      defaultGlobalSafetyBuffer: { type: Number, default: 5 },
    },
    pickup: {
      type: PickupSchema,
      default: () => ({ ...DEFAULT_PICKUP_CONFIG }),
    },
    banners: {
      type: [BannerSchema],
      default: [],
    },
  },
  { timestamps: true }
)

export const StoreSettings =
  mongoose.models.StoreSettings || model<IStoreSettings>('StoreSettings', StoreSettingsSchema)

let cachedPickup: IPickupSettings | null = null
let cacheExpiry = 0

export async function getStorePickupSettings(): Promise<IPickupSettings> {
  const now = Date.now()
  if (cachedPickup && now < cacheExpiry) {
    return cachedPickup
  }

  try {
    const settings = await StoreSettings.findOne().select('pickup').lean()
    if (!settings || !settings.pickup) {
      cachedPickup = { ...DEFAULT_PICKUP_CONFIG }
    } else {
      const schedule = normalizeSchedule(settings.pickup.schedule)
      cachedPickup = {
        enabled: settings.pickup.enabled ?? DEFAULT_PICKUP_CONFIG.enabled,
        address: {
          street: settings.pickup.address?.street || DEFAULT_PICKUP_CONFIG.address.street,
          postalCode: settings.pickup.address?.postalCode || DEFAULT_PICKUP_CONFIG.address.postalCode,
          city: settings.pickup.address?.city || DEFAULT_PICKUP_CONFIG.address.city,
          country: settings.pickup.address?.country || DEFAULT_PICKUP_CONFIG.address.country,
        },
        schedule,
        pickupHours: {
          ar: settings.pickup.pickupHours?.ar || formatWeeklySchedule(schedule, 'ar'),
          sv: settings.pickup.pickupHours?.sv || formatWeeklySchedule(schedule, 'sv'),
          en: settings.pickup.pickupHours?.en || formatWeeklySchedule(schedule, 'en'),
        },
        instructions: {
          ar: settings.pickup.instructions?.ar || DEFAULT_PICKUP_CONFIG.instructions.ar,
          sv: settings.pickup.instructions?.sv || DEFAULT_PICKUP_CONFIG.instructions.sv,
          en: settings.pickup.instructions?.en || DEFAULT_PICKUP_CONFIG.instructions.en,
        },
      }
    }
  } catch (err) {
    cachedPickup = { ...DEFAULT_PICKUP_CONFIG }
  }

  cacheExpiry = now + 5 * 60 * 1000 // 5 minutes cache
  return cachedPickup
}

export function clearPickupSettingsCache() {
  cachedPickup = null
  cacheExpiry = 0
}