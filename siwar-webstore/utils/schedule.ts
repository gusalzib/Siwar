// utils/schedule.ts

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
    const startName = DAY_LABELS[locale]?.[g.startDay] || DAY_LABELS.sv[g.startDay]
    const endName = DAY_LABELS[locale]?.[g.endDay] || DAY_LABELS.sv[g.endDay]
    const dayLabel = g.startDay === g.endDay ? startName : `${startName} - ${endName}`
    const timeLabel = g.isOpen ? g.timeSignature : (CLOSED_LABEL[locale] || CLOSED_LABEL.sv)

    return `${dayLabel}: ${timeLabel}`
  })

  return parts.join(' | ')
}

export interface IGeneralSettings {
  storeName: {
    ar: string
    sv: string
    en: string
  }
  tagline?: {
    ar?: string
    sv?: string
    en?: string
  }
  company: {
    name: string
    orgNumber: string
    vatNumber: string
  }
  contact: {
    email: string
    phone: string
  }
  address: {
    street: string
    postalCode: string
    city: string
    country: string
  }
  schedule: IDaySchedule[]
  openingHours?: {
    ar?: string
    sv?: string
    en?: string
  }
}

export const DEFAULT_GENERAL_CONFIG: IGeneralSettings = {
  storeName: {
    ar: 'سوار',
    sv: 'Siwar',
    en: 'Siwar',
  },
  tagline: {
    ar: 'متجرك المفضل للمنتجات والمأكولات الشرقية الأصيلة',
    sv: 'Din orientaliska livsmedelsbutik i Halmstad',
    en: 'Your authentic Middle Eastern grocery store',
  },
  company: {
    name: 'Siwar Butik AB',
    orgNumber: '559123-4567',
    vatNumber: 'SE559123456701',
  },
  contact: {
    email: 'order@siwar.se',
    phone: '+46 35 123 456',
  },
  address: {
    street: 'Storgatan 12',
    postalCode: '302 43',
    city: 'Halmstad',
    country: 'Sverige',
  },
  schedule: DEFAULT_WEEKLY_SCHEDULE.map((d) => ({ ...d })),
  openingHours: {
    ar: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'ar'),
    sv: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'sv'),
    en: formatWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE, 'en'),
  },
}
