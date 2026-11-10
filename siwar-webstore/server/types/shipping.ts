// server/types/shipping.ts

/**
 * Domain types and payload contracts for decoupled shipping carrier integrations.
 * Supports automated consignment booking, scale weight verification, parcel sizing,
 * service point lookup, and scannable handover card generation.
 */

export type ShippingCarrierName = 'DHL' | 'POSTNORD' | 'SCHENKER' | 'MOCK'

/**
 * Standardized shipping address structure for both consignor (sender) and consignee (recipient).
 */
export interface ShipmentAddress {
  /** Full recipient/sender contact name */
  name: string
  /** Optional company name or statutory business entity */
  companyName?: string
  /** Street address including street name and number */
  street: string
  /** Postal code / Postnummer */
  postalCode: string
  /** City / Postort */
  city: string
  /** ISO 3166-1 alpha-2 country code (e.g. 'SE') */
  countryCode: string
  /** Contact email address for delivery notifications and tracking receipts */
  email: string
  /** Contact phone number formatted for carrier SMS alerts (e.g. '0701234567' or '+46701234567') */
  phone: string
}

/**
 * Standard parcel dimensions preset names used in the admin packing station.
 */
export type ParcelPresetName = 'LITEN' | 'MELLAN' | 'STOR' | 'CUSTOM'

/**
 * Package parcel physical metrics including verified scale weight and carton dimensions.
 */
export interface PackageParcel {
  /**
   * Measured physical scale weight in kilograms (including carton and tare weight).
   * Takes precedence over pre-calculated product catalog grossWeight to prevent carrier re-weigh penalties.
   */
  weightKg: number
  /** Box length in centimeters */
  lengthCm: number
  /** Box width in centimeters */
  widthCm: number
  /** Box height in centimeters */
  heightCm: number
  /** Quick-select preset used during packing, if applicable */
  preset?: ParcelPresetName
  /** Description of goods inside the carton (e.g. 'Livsmedel / Food items') */
  contentsDescription?: string
}

/**
 * Parameter payload passed to carrier adapters to book an outbound consignment.
 */
export interface CreateShipmentOptions {
  /** Internal MongoDB Order ID */
  orderId: string
  /** Human-readable order reference (e.g. 'ORD-2026-101') */
  orderReference: string
  /** Consignee / customer delivery address */
  recipient: ShipmentAddress
  /** Parcel physical dimensions and measured gross weight */
  parcel: PackageParcel
  /**
   * Consignor / merchant sender address.
   * If omitted, the carrier adapter resolves the default sender from StoreSettings / consignor configuration.
   */
  sender?: ShipmentAddress
  /**
   * Optional specific DHL Service Point ID chosen for delivery.
   * If not provided, DHL routes to the optimal nearest service point based on the recipient's postal code.
   */
  servicePointId?: string
  /**
   * Carrier specific product code (defaults to '103' for DHL Freight Sweden Servicepoint).
   */
  productCode?: string
  /** Optional merchant custom reference or notes passed to carrier */
  reference?: string
}

/**
 * Normalized result contract returned upon successful consignment booking with a carrier.
 */
export interface ShipmentBookingResult {
  /** Name of the carrier handling the shipment (e.g. 'DHL') */
  carrier: ShippingCarrierName
  /** Master consignment reference / Sändningsnummer */
  consignmentNumber: string
  /**
   * Primary parcel tracking number (18-digit Kolli-ID for DHL Sweden).
   * Scanned by DHL drivers or counter staff and displayed in the Code 128 mobile handover card.
   */
  trackingCode: string
  /** Formatted public tracking URL directly accessible to staff and customers */
  trackingUrl: string
  /** Optional URL or base64 stream to fetch the printable PDF shipping label if emergency fallback is required */
  labelUrl?: string
  /** Carrier internal routing or depot code */
  routingCode?: string
  /** Details of the destination access point / Service Point if designated */
  servicePoint?: {
    id: string
    name?: string
    address?: string
    postalCode?: string
    city?: string
  }
  /** Raw unprocessed response payload returned by the carrier API for auditing/logging */
  rawResponse?: unknown
}

/**
 * Criteria for querying nearest parcel pickup / drop-off service points.
 */
export interface ServicePointSearchOptions {
  /** 5-digit Swedish postal code without spaces (e.g. '30243') */
  postalCode: string
  /** ISO country code, default 'SE' */
  countryCode?: string
  /** Optional city name to narrow search */
  city?: string
  /** Optional street address for exact radius calculation */
  street?: string
  /** Maximum number of nearest access points to return (defaults to 5) */
  maxResults?: number
}

/**
 * Normalized representation of a carrier access point / ombud / parcel locker.
 */
export interface NearestServicePoint {
  /** Carrier-unique service point identifier */
  id: string
  /** Facility or merchant name (e.g. 'ICA Supermarket Halmstad', 'Direkten') */
  name: string
  /** Street address */
  street: string
  /** Postal code */
  postalCode: string
  /** City name */
  city: string
  /** Distance from search origin in meters, if calculated by carrier */
  distanceMeters?: number
  /** Human-readable opening hours string */
  openingHours?: string
}

/**
 * Standardized domain adapter interface that all carrier implementations must satisfy.
 * Ensures complete decoupling of fulfillment workflows from specific logistics vendors.
 */
export interface ShippingCarrierAdapter {
  /** Unique identifier of the carrier */
  readonly carrierName: ShippingCarrierName

  /**
   * Books an outbound parcel consignment with the carrier's booking or transport instruction API.
   *
   * @param options Consignment parameters including recipient, parcel scale metrics, and order reference.
   * @returns Normalized booking confirmation containing Kolli-ID, consignment ID, and tracking URL.
   */
  createShipment(options: CreateShipmentOptions): Promise<ShipmentBookingResult>

  /**
   * Searches for the closest service points / ombud relative to a postal code or address.
   *
   * @param options Search parameters including postal code and country.
   * @returns Array of nearby service point locations.
   */
  findNearestServicePoints(options: ServicePointSearchOptions): Promise<NearestServicePoint[]>

  /**
   * Constructs the verified public tracking link for customer emails and admin lookup.
   *
   * @param trackingCode 18-digit Kolli-ID or consignment identifier.
   */
  getTrackingUrl(trackingCode: string): string

  /**
   * Generates a deterministic mock shipment booking when operating in sandbox or offline development.
   *
   * @param options Consignment options to seed the mock response.
   */
  generateMockShipment(options: CreateShipmentOptions): ShipmentBookingResult
}

