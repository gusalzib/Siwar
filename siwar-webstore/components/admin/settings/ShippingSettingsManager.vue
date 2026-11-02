<!-- components/admin/settings/ShippingSettingsManager.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue'

const { t } = useI18n()

// Fetch shipping settings from admin API
const { data: settingsData, pending: isLoading, refresh } = await useFetch<any>('/api/admin/settings/shipping')

const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

interface ShippingTierForm {
  maxWeightGrams: number
  feeSEK: number
}

const freeShippingThresholdSEK = ref(899)
const freeShippingItemGrantsEntireOrder = ref(false)
const deliveryDays = ref({ min: 1, max: 3 })
const tiers = ref<ShippingTierForm[]>([
  { maxWeightGrams: 3000, feeSEK: 77 },
  { maxWeightGrams: 7000, feeSEK: 89 },
  { maxWeightGrams: 9999999, feeSEK: 109 },
])

function populateForm(data: any) {
  if (!data) return

  if (typeof data.freeShippingThresholdMinorSEK === 'number') {
    freeShippingThresholdSEK.value = Math.round(data.freeShippingThresholdMinorSEK / 100)
  }

  freeShippingItemGrantsEntireOrder.value = Boolean(data.freeShippingItemGrantsEntireOrder)

  if (data.deliveryDays) {
    deliveryDays.value = {
      min: Number(data.deliveryDays.min ?? 1),
      max: Number(data.deliveryDays.max ?? 3),
    }
  }

  if (Array.isArray(data.tiers) && data.tiers.length > 0) {
    tiers.value = data.tiers.map((t: any) => ({
      maxWeightGrams: Number(t.maxWeightGrams),
      feeSEK: Math.round(Number(t.feeMinorSEK ?? 0) / 100),
    }))
  }
}

watch(
  settingsData,
  (val) => {
    if (val) populateForm(val)
  },
  { immediate: true }
)

function addTier() {
  const lastTier = tiers.value[tiers.value.length - 1]
  const newWeight = lastTier ? lastTier.maxWeightGrams + 3000 : 3000
  const newFee = lastTier ? lastTier.feeSEK + 20 : 79
  tiers.value.push({
    maxWeightGrams: newWeight,
    feeSEK: newFee,
  })
}

function removeTier(index: number) {
  if (tiers.value.length <= 1) {
    errorMessage.value = t('admin.settings.shipping.minOneTierError', 'Minst ett viktintervall måste konfigureras.')
    return
  }
  tiers.value.splice(index, 1)
}

function formatWeightLabel(grams: number): string {
  if (grams >= 9999999 || grams === Infinity) {
    return t('admin.settings.shipping.unlimitedWeight', 'Obegränsad (högsta klassen)')
  }
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1).replace(/\.0$/, '')} kg`
  }
  return `${grams} g`
}

async function handleSave() {
  errorMessage.value = ''
  successMessage.value = ''

  if (freeShippingThresholdSEK.value < 0) {
    errorMessage.value = t('admin.settings.shipping.invalidThreshold', 'Tröskelvärde för fri frakt kan inte vara negativt.')
    return
  }

  if (deliveryDays.value.min < 0 || deliveryDays.value.max < deliveryDays.value.min) {
    errorMessage.value = t('admin.settings.shipping.invalidDeliveryDays', 'Ogiltiga leveransdagar: Högsta antal dagar kan inte vara lägre än minsta.')
    return
  }

  if (tiers.value.length === 0) {
    errorMessage.value = t('admin.settings.shipping.minOneTierError', 'Minst ett viktintervall krävs.')
    return
  }

  isSaving.value = true

  try {
    // Sort tiers ascending by maxWeightGrams
    const sortedTiers = [...tiers.value].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)

    const payload = {
      freeShippingThresholdMinorSEK: Math.round(Number(freeShippingThresholdSEK.value) * 100),
      freeShippingItemGrantsEntireOrder: Boolean(freeShippingItemGrantsEntireOrder.value),
      deliveryDays: {
        min: Number(deliveryDays.value.min),
        max: Number(deliveryDays.value.max),
      },
      tiers: sortedTiers.map((t) => ({
        maxWeightGrams: Number(t.maxWeightGrams),
        feeMinorSEK: Math.round(Number(t.feeSEK) * 100),
      })),
    }

    const res = await $fetch<any>('/api/admin/settings/shipping', {
      method: 'PUT',
      body: payload,
    })

    if (res?.shipping) {
      populateForm(res.shipping)
    }

    successMessage.value = t('admin.settings.shipping.savedSuccess', 'Fraktinställningarna har sparats framgångsrikt!')
    await refresh()
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || t('admin.settings.shipping.saveError', 'Ett fel uppstod vid sparande.')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Feedback Alerts -->
    <div
      v-if="successMessage"
      class="alert alert-success shadow-sm flex items-center justify-between text-sm py-3 text-success-content"
    >
      <div class="flex items-center gap-2">
        <Icon name="lucide:check-circle-2" class="size-5 shrink-0" />
        <span>{{ successMessage }}</span>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-circle"
        @click="successMessage = ''"
      >
        <Icon name="lucide:x" class="size-4" />
      </button>
    </div>

    <div
      v-if="errorMessage"
      class="alert alert-error shadow-sm flex items-center justify-between text-sm py-3 text-error-content"
    >
      <div class="flex items-center gap-2">
        <Icon name="lucide:alert-triangle" class="size-5 shrink-0" />
        <span>{{ errorMessage }}</span>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-xs btn-circle text-white"
        @click="errorMessage = ''"
      >
        <Icon name="lucide:x" class="size-4" />
      </button>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="card bg-base-100 border border-base-200 shadow-sm p-8">
      <div class="flex flex-col items-center justify-center py-12 space-y-3">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <span class="text-sm text-base-content/60">{{ t('admin.settings.shipping.loading', 'Laddar fraktinställningar...') }}</span>
      </div>
    </div>

    <form v-else @submit.prevent="handleSave" class="space-y-6">
      <!-- Section 1: Promotional Free Shipping Rule (FR-6 / FR-9) -->
      <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div class="card-body p-6 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-base-200 pb-4">
            <div>
              <h2 class="text-base sm:text-lg font-extrabold text-base-content flex items-center gap-2">
                <Icon name="lucide:sparkles" class="size-5 text-amber-500" />
                {{ t('admin.settings.shipping.campaignRuleTitle', 'Kampanjregel: Produkter med fri frakt') }}
              </h2>
              <p class="text-xs sm:text-sm text-base-content/60 mt-0.5">
                {{ t('admin.settings.shipping.campaignRuleSubtitle', 'Styr hur kampanjprodukter med fri frakt påverkar hela varukorgen.') }}
              </p>
            </div>
            <span class="badge badge-sm font-bold self-start sm:self-auto" :class="freeShippingItemGrantsEntireOrder ? 'badge-primary text-white' : 'badge-ghost'">
              {{ freeShippingItemGrantsEntireOrder ? t('admin.settings.shipping.campaignActive', 'Kampanjläge På') : t('admin.settings.shipping.standardMode', 'Standardläge') }}
            </span>
          </div>

          <!-- Toggle switch container with high-contrast toggle -->
          <div 
            class="rounded-2xl border-2 p-4 transition-all" 
            :class="freeShippingItemGrantsEntireOrder ? 'border-primary/60 bg-primary/5 dark:bg-primary/10' : 'border-base-300 bg-base-200/50'"
          >
            <label class="label cursor-pointer justify-between gap-4 p-0">
              <div class="space-y-1 pr-4">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:truck" class="size-5" :class="freeShippingItemGrantsEntireOrder ? 'text-primary' : 'text-base-content/60'" />
                  <span class="text-sm sm:text-base font-bold text-base-content">
                    {{ t('admin.settings.shipping.campaignRuleLabel', '1 produkt med fri frakt bjuder på frakten för hela beställningen') }}
                  </span>
                </div>
                <p class="text-xs text-base-content/70">
                  {{ freeShippingItemGrantsEntireOrder ? t('admin.settings.shipping.campaignRuleActive', 'Om varukorgen innehåller minst en produkt med fri frakt bjuder vi på fraktkostnaden för hela beställningen oavsett vikt eller andra varor.') : t('admin.settings.shipping.campaignRuleInactive', 'Produkter med fri frakt är undantagna från fraktviktsberäkningen, men ger inte automatiskt fri frakt för hela ordern om kunden också köper vanliga varor.') }}
                </p>
              </div>
              <input
                v-model="freeShippingItemGrantsEntireOrder"
                type="checkbox"
                class="toggle toggle-primary toggle-md shrink-0 border-base-300 bg-base-300 checked:bg-primary checked:border-primary shadow-sm"
              />
            </label>
          </div>

          <!-- Localized Thorough Explanation Callout -->
          <div class="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/30 p-4 space-y-2 text-xs leading-relaxed text-blue-950 dark:text-blue-100">
            <div class="flex items-center gap-2 font-bold text-blue-800 dark:text-blue-300">
              <Icon name="lucide:info" class="size-4 shrink-0" />
              <span>{{ t('admin.settings.shipping.campaignRuleGuideTitle', 'När ska denna inställning användas?') }}</span>
            </div>
            <p>
              {{ t('admin.settings.shipping.campaignRuleExplanation', 'Under intensiva marknadsföringskampanjer kan du aktivera detta som en konverteringshöjare ("Köp valfri presentlåda så bjuder vi på frakten för hela din beställning!"). I normal butiksdrift hålls detta avstängt så att kunder inte kan kringgå fraktkostnaden på tunga bulkköp (t.ex. 20 kg ris och matolja) genom att bara lägga till en liten 50 g kryddpåse med fri frakt.') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Section 2: Free Shipping Threshold & Delivery Days -->
      <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div class="card-body p-6 space-y-5">
          <div class="border-b border-base-200 pb-3">
            <h2 class="text-base sm:text-lg font-extrabold text-base-content flex items-center gap-2">
              <Icon name="lucide:gift" class="size-5 text-emerald-600 dark:text-emerald-400" />
              {{ t('admin.settings.shipping.thresholdTitle', 'Beloppsgräns för fri frakt & Leveranstid') }}
            </h2>
            <p class="text-xs sm:text-sm text-base-content/60 mt-0.5">
              {{ t('admin.settings.shipping.thresholdDesc', 'Automatiskt fri frakt när varuvärdet når denna nivå.') }}
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            <!-- Threshold SEK -->
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text font-bold text-xs sm:text-sm text-base-content">
                  {{ t('admin.settings.shipping.thresholdLabel', 'Gräns för fri frakt (SEK)') }} *
                </span>
              </label>
              <div class="relative">
                <input
                  v-model.number="freeShippingThresholdSEK"
                  type="number"
                  min="0"
                  step="1"
                  required
                  class="input input-bordered border-base-300 focus:border-primary w-full font-mono font-bold pe-14 text-base bg-base-100"
                />
                <span class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-xs font-bold text-base-content/60">
                  SEK
                </span>
              </div>
              <label class="label pt-1">
                <span class="label-text-alt text-base-content/70">
                  {{ t('admin.settings.shipping.thresholdHelp', 'T.ex. 899 SEK (motsvarar 89 900 öre)') }}
                </span>
              </label>
            </div>

            <!-- Delivery Days Min -->
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text font-bold text-xs sm:text-sm text-base-content">
                  {{ t('admin.settings.shipping.minDaysLabel', 'Minsta antal leveransdagar') }} *
                </span>
              </label>
              <div class="relative">
                <input
                  v-model.number="deliveryDays.min"
                  type="number"
                  min="0"
                  max="30"
                  step="1"
                  required
                  class="input input-bordered border-base-300 focus:border-primary w-full font-mono pe-14 bg-base-100"
                />
                <span class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-xs font-semibold text-base-content/60">
                  {{ t('admin.settings.shipping.daysUnit', 'dagar') }}
                </span>
              </div>
            </div>

            <!-- Delivery Days Max -->
            <div class="form-control">
              <label class="label pb-1">
                <span class="label-text font-bold text-xs sm:text-sm text-base-content">
                  {{ t('admin.settings.shipping.maxDaysLabel', 'Högsta antal leveransdagar') }} *
                </span>
              </label>
              <div class="relative">
                <input
                  v-model.number="deliveryDays.max"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  required
                  class="input input-bordered border-base-300 focus:border-primary w-full font-mono pe-14 bg-base-100"
                />
                <span class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4 text-xs font-semibold text-base-content/60">
                  {{ t('admin.settings.shipping.daysUnit', 'dagar') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Weight Tiers Table -->
      <div class="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
        <div class="card-body p-6 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base-200 pb-4">
            <div>
              <h2 class="text-base sm:text-lg font-extrabold text-base-content flex items-center gap-2">
                <Icon name="lucide:scale" class="size-5 text-primary" />
                {{ t('admin.settings.shipping.tiersTitle', 'Viktbaserade fraktklasser & avgifter') }}
              </h2>
              <p class="text-xs sm:text-sm text-base-content/60 mt-0.5">
                {{ t('admin.settings.shipping.tiersDesc', 'Fraktavgiften beräknas efter paketets sammanlagda bruttovikt exklusive fri-frakt-artiklar.') }}
              </p>
            </div>
            <!-- High contrast solid button -->
            <button
              type="button"
              @click="addTier"
              class="btn btn-sm bg-brand-600 hover:bg-brand-700 border-none text-white font-bold gap-1.5 self-start sm:self-auto shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 px-3"            >
              <Icon name="lucide:plus" class="size-4" />
              {{ t('admin.settings.shipping.addTier', 'Lägg till intervall') }}
            </button>
          </div>

          <!-- Tiers List Table -->
          <div class="overflow-x-auto">
            <table class="table table-sm sm:table-md w-full">
              <thead>
                <tr class="text-xs font-bold uppercase tracking-wider text-base-content/70 border-b border-base-300">
                  <th class="w-12 text-center">#</th>
                  <th>{{ t('admin.settings.shipping.maxWeightLabel', 'Maxvikt (gram)') }}</th>
                  <th>{{ t('admin.settings.shipping.weightFormatted', 'Visning') }}</th>
                  <th>{{ t('admin.settings.shipping.feeLabel', 'Fraktavgift (SEK)') }}</th>
                  <th class="w-20 text-end">{{ t('admin.settings.shipping.action', 'Åtgärd') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tier, idx) in tiers"
                  :key="idx"
                  class="hover:bg-base-200/50 transition-colors border-b border-base-200"
                >
                  <td class="text-center font-mono text-xs text-base-content/60">
                    {{ idx + 1 }}
                  </td>
                  <td>
                    <div class="relative max-w-xs">
                      <input
                        v-model.number="tier.maxWeightGrams"
                        type="number"
                        min="1"
                        step="100"
                        required
                        class="input input-bordered border-base-300 focus:border-primary input-sm font-mono w-full pe-10 bg-base-100"
                      />
                      <span class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-xs text-base-content/60 font-medium">
                        g
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-sm badge-neutral font-mono font-medium">
                      {{ formatWeightLabel(tier.maxWeightGrams) }}
                    </span>
                  </td>
                  <td>
                    <div class="relative max-w-xs">
                      <input
                        v-model.number="tier.feeSEK"
                        type="number"
                        min="0"
                        step="1"
                        required
                        class="input input-bordered border-base-300 focus:border-primary input-sm font-mono font-bold w-full pe-14 text-emerald-700 dark:text-emerald-400 bg-base-100"
                      />
                      <span class="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-xs font-bold text-base-content/60">
                        SEK
                      </span>
                    </div>
                  </td>
                  <td class="text-end">
                    <button
                      type="button"
                      :disabled="tiers.length <= 1"
                      @click="removeTier(idx)"
                      class="btn btn-ghost btn-xs text-error disabled:opacity-30 hover:bg-error/10"
                      :title="t('admin.settings.shipping.removeTier', 'Ta bort intervall')"
                    >
                      <Icon name="lucide:trash-2" class="size-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Save Button Bar -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-base-300">
        <button
          type="button"
          :disabled="isSaving"
          @click="() => refresh()"
          class="btn btn-ghost border border-base-300 text-base-content/80 hover:bg-base-200"
        >
          <Icon name="lucide:rotate-ccw" class="size-4" />
          {{ t('common.cancel', 'Återställ') }}
        </button>
        <!-- Solid background and contrast text guaranteed -->
        <button
          type="submit"
          :disabled="isSaving"
          class="btn bg-primary hover:bg-primary/90 text-white font-bold gap-2 px-8 shadow-md border-primary"
        >
          <span v-if="isSaving" class="loading loading-spinner loading-sm"></span>
          <Icon v-else name="lucide:save" class="size-4" />
          {{ isSaving ? t('common.saving', 'Sparar...') : t('admin.settings.shipping.saveChanges', 'Spara fraktinställningar') }}
        </button>
      </div>
    </form>
  </div>
</template>
