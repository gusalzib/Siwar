<!-- pages/about.vue - Om oss / About Us / من نحن -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import SocialMediaShelf from '~/components/SocialMediaShelf.vue'

const { t } = useI18n()
const localePath = useLocalePath()

// Fetch dynamic store general settings for address and social links
const { data: storeInfo } = await useFetch<any>('/api/settings', {
  lazy: true,
})

interface IGalleryItem {
  id: string
  titleKey: string
  descKey: string
  imageSrc: string
  alt: string
  spanClass: string
}

const galleryItems: IGalleryItem[] = [
  {
    id: 'storefront',
    titleKey: 'aboutPage.gallery.items.storefront.title',
    descKey: 'aboutPage.gallery.items.storefront.desc',
    imageSrc: '/images/about/storefront.svg',
    alt: 'Siwar Butik Halmstad storefront façade',
    spanClass: 'sm:col-span-2 lg:col-span-2 aspect-16/10',
  },
  {
    id: 'spices',
    titleKey: 'aboutPage.gallery.items.spices.title',
    descKey: 'aboutPage.gallery.items.spices.desc',
    imageSrc: '/images/about/spices.svg',
    alt: 'Aromatic Middle Eastern spices bazaar',
    spanClass: 'sm:col-span-1 lg:col-span-1 aspect-4/3',
  },
  {
    id: 'sweets',
    titleKey: 'aboutPage.gallery.items.sweets.title',
    descKey: 'aboutPage.gallery.items.sweets.desc',
    imageSrc: '/images/about/sweets.svg',
    alt: 'Crisp pistachio baklava and traditional sweets',
    spanClass: 'sm:col-span-1 lg:col-span-1 aspect-4/3',
  },
  {
    id: 'delicacies',
    titleKey: 'aboutPage.gallery.items.delicacies.title',
    descKey: 'aboutPage.gallery.items.delicacies.desc',
    imageSrc: '/images/about/delicacies.svg',
    alt: 'Gourmet olive oils, tahini and Mediterranean groceries',
    spanClass: 'sm:col-span-2 lg:col-span-2 aspect-16/10',
  },
]

// Lightbox modal state for expanding collage photos
const activePhoto = ref<IGalleryItem | null>(null)
const photoModalRef = ref<HTMLDialogElement | null>(null)

function openPhoto(item: IGalleryItem) {
  activePhoto.value = item
  photoModalRef.value?.showModal()
}

function closePhoto() {
  photoModalRef.value?.close()
  activePhoto.value = null
}

// Active social links check
const hasActiveSocial = computed(() => {
  return Array.isArray(storeInfo.value?.socialLinks) &&
    storeInfo.value.socialLinks.some((l: any) => l && l.isActive !== false && typeof l.url === 'string' && l.url.trim().length > 0)
})

useSeoMeta({
  title: () => `${t('aboutPage.metaTitle', 'Om oss')} | Siwar`,
  description: () => t('aboutPage.metaDesc', 'Lär känna Siwar Butik i Halmstad.'),
  ogTitle: () => `${t('aboutPage.metaTitle', 'Om oss')} | Siwar`,
  ogDescription: () => t('aboutPage.metaDesc', 'Lär känna Siwar Butik i Halmstad.'),
})
</script>

<template>
  <div class="min-h-screen py-6 sm:py-10 space-y-12 sm:space-y-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    
    <!-- 1. Hero Section -->
    <header class="text-center space-y-4 max-w-3xl mx-auto pt-2 sm:pt-4">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/20 text-xs font-bold tracking-wide uppercase">
        <Icon name="lucide:sparkles" class="size-4 text-brand-500" />
        <span>{{ t('aboutPage.badge', 'Vår historia & arv') }}</span>
      </div>

      <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-base-content leading-tight">
        {{ t('aboutPage.title', 'Äkta smaker från Orienten mitt i Halmstad') }}
      </h1>

      <p class="text-sm sm:text-lg text-base-content/75 leading-relaxed font-medium">
        {{ t('aboutPage.subtitle', 'Sedan starten har vår vision varit enkel: att erbjuda det bästa ur det orientaliska och medelhavsinspirerade köket med passion för tradition, hantverk och råvaror av högsta kvalitet.') }}
      </p>
    </header>

    <!-- Decorative Divider -->
    <div class="flex items-center justify-center gap-4 py-2">
      <div class="h-px bg-base-300 dark:bg-zinc-800 flex-1 max-w-xs" />
      <Icon name="lucide:heart-handshake" class="size-5 text-brand-500 shrink-0" />
      <div class="h-px bg-base-300 dark:bg-zinc-800 flex-1 max-w-xs" />
    </div>

    <!-- 2. Heritage Story & Three Value Pillars -->
    <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <!-- Story Narrative -->
      <div class="lg:col-span-7 space-y-5">
        <div class="inline-flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          <Icon name="lucide:book-open" class="size-4" />
          <span>{{ t('aboutPage.story.title', 'En levande mötesplats för matglädje och gemenskap') }}</span>
        </div>

        <h2 class="text-2xl sm:text-3xl font-extrabold text-base-content tracking-tight">
          {{ t('aboutPage.story.title', 'En levande mötesplats för matglädje och gemenskap') }}
        </h2>

        <p class="text-sm sm:text-base text-base-content/80 leading-relaxed font-normal">
          {{ t('aboutPage.story.p1', 'Siwar Butik grundades med en passion för det rika kulturarv och de generösa smakerna som präglar Mellanöstern och Medelhavet. Hos oss hittar du allt från solmogna oliver, krispiga nötter och dagsfärsk baklava till noga utvalda kryddor, tahini och premium basmatiris direkt från betrodda producenter.') }}
        </p>

        <p class="text-sm sm:text-base text-base-content/80 leading-relaxed font-normal">
          {{ t('aboutPage.story.p2', 'Vi tror att mat förenar människor och bygger broar mellan kulturer. Vårt engagerade butiksteam hjälper dig gärna att hitta rätt råvaror för traditionella familjerecept, oavsett om du lagar en mustig gryta med sumac och za\'atar eller vill bjuda nära och kära på sött kardemummakaffe och dadlar.') }}
        </p>

        <div class="pt-2 flex flex-wrap gap-3">
          <NuxtLink
            :to="localePath('/catalog')"
            class="btn bg-brand-500 hover:bg-brand-600 !text-white font-bold border-none rounded-xl gap-2 shadow-sm"
          >
            <Icon name="lucide:shopping-bag" class="size-4" />
            <span>{{ t('nav.catalog', 'Utforska sortimentet') }}</span>
          </NuxtLink>

          <NuxtLink
            :to="localePath('/oppettider')"
            class="btn btn-outline border-base-300 hover:border-brand-500 text-base-content font-bold rounded-xl gap-2"
          >
            <Icon name="lucide:map-pin" class="size-4 text-primary" />
            <span>{{ t('aboutPage.visit.findUs', 'Hitta till oss') }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Feature Card Showcase -->
      <div class="lg:col-span-5 space-y-4">
        <!-- Pillar 1 -->
        <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-start gap-4">
            <div class="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Icon name="lucide:award" class="size-6" />
            </div>
            <div class="space-y-1">
              <h3 class="font-bold text-base text-base-content">
                {{ t('aboutPage.pillars.p1.title', 'Handplockat & Autentiskt') }}
              </h3>
              <p class="text-xs sm:text-sm text-base-content/70 leading-relaxed">
                {{ t('aboutPage.pillars.p1.desc', 'Vi importerar noggrant utvalda delikatesser från traditionella producenter i Mellanöstern och Medelhavsområdet.') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Pillar 2 -->
        <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-start gap-4">
            <div class="size-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Icon name="lucide:leaf" class="size-6" />
            </div>
            <div class="space-y-1">
              <h3 class="font-bold text-base text-base-content">
                {{ t('aboutPage.pillars.p2.title', 'Färska Kryddor & Råvaror') }}
              </h3>
              <p class="text-xs sm:text-sm text-base-content/70 leading-relaxed">
                {{ t('aboutPage.pillars.p2.desc', 'Doftande kryddor, torkade örter, baljväxter och dagsfärska specialiteter för den genuina smakupplevelsen.') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Pillar 3 -->
        <div class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div class="flex items-start gap-4">
            <div class="size-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Icon name="lucide:smile" class="size-6" />
            </div>
            <div class="space-y-1">
              <h3 class="font-bold text-base text-base-content">
                {{ t('aboutPage.pillars.p3.title', 'Varmt & Personligt Bemötande') }}
              </h3>
              <p class="text-xs sm:text-sm text-base-content/70 leading-relaxed">
                {{ t('aboutPage.pillars.p3.desc', 'Vi är stolta över att vara en lokal mötesplats i Halmstad där varje besökare möts med personlig service och kunskap.') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Physical Storefront Showcase & Photo Collage with Expand Modal -->
    <section class="space-y-6 pt-4">
      <div class="text-center max-w-2xl mx-auto space-y-2">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-100 dark:bg-zinc-800 border border-base-300 dark:border-zinc-700 text-xs font-bold text-base-content/80">
          <Icon name="lucide:camera" class="size-3.5 text-primary" />
          <span>{{ t('aboutPage.gallery.badge', 'Fysisk butiksmiljö') }}</span>
        </div>
        <h2 class="text-2xl sm:text-4xl font-extrabold text-base-content tracking-tight">
          {{ t('aboutPage.gallery.title', 'Välkommen in till butiken i Halmstad') }}
        </h2>
        <p class="text-xs sm:text-sm text-base-content/70">
          {{ t('aboutPage.gallery.desc', 'Upptäck vår välfyllda butikslokal, dofterna från kryddavdelningen och vårt breda sortiment av orientaliska delikatesser. Klicka på bilderna för att förstora.') }}
        </p>
      </div>

      <!-- Collage Grid (3-4 Photos) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-2">
        <div
          v-for="item in galleryItems"
          :key="item.id"
          class="group relative overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-zinc-800 bg-base-100 dark:bg-zinc-900 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
          tabindex="0"
          role="button"
          :aria-label="t(item.titleKey)"
          @click="openPhoto(item)"
          @keydown.enter="openPhoto(item)"
        >
          <!-- Image -->
          <div class="relative w-full aspect-16/10 overflow-hidden bg-slate-900">
            <img
              :src="item.imageSrc"
              :alt="item.alt"
              class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <!-- Gradient Overlay for Contrast -->
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

            <!-- Click to expand pill indicator -->
            <div class="absolute top-3.5 end-3.5 px-2.5 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm border border-white/10 group-hover:bg-brand-500 group-hover:border-brand-500 transition-colors">
              <Icon name="lucide:maximize-2" class="size-3" />
              <span>{{ t('aboutPage.gallery.clickToExpand', 'Förstora') }}</span>
            </div>

            <!-- Title & Caption on Bottom of Card -->
            <div class="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white space-y-1">
              <h3 class="font-bold text-base sm:text-lg tracking-tight leading-snug">
                {{ t(item.titleKey) }}
              </h3>
              <p class="text-xs text-slate-300 line-clamp-2 font-normal leading-relaxed">
                {{ t(item.descKey) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Community & Social Media Section (Explicit Requirement) -->
    <section class="card bg-slate-900 text-white border-2 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-lg">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8">
        <div class="space-y-2 max-w-xl">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold uppercase tracking-wider">
            <Icon name="lucide:share-2" class="size-3.5 text-brand-400" />
            <span>{{ t('aboutPage.social.badge', 'Följ vår gemenskap') }}</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {{ t('aboutPage.social.title', 'Följ Siwar på sociala medier') }}
          </h2>
          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
            {{ t('aboutPage.social.desc', 'Missa inga nya säsongsleveranser, helgerbjudanden eller goda recept. Följ oss och bli en del av Siwar-familjen!') }}
          </p>
        </div>

        <!-- Social Media Shelf -->
        <div class="shrink-0 flex items-center">
          <SocialMediaShelf :links="storeInfo?.socialLinks" size="lg" />
        </div>
      </div>
    </section>

    <!-- 5. Physical Visit Callout Card -->
    <section class="card bg-base-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div class="flex items-start gap-4">
          <div class="size-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Icon name="lucide:store" class="size-6" />
          </div>
          <div class="space-y-1">
            <h3 class="text-xl font-bold text-base-content tracking-tight">
              {{ t('aboutPage.visit.title', 'Upplev butiken på plats i Halmstad') }}
            </h3>
            <p class="text-xs sm:text-sm text-base-content/70 max-w-xl leading-relaxed">
              {{ t('aboutPage.visit.desc', 'Du hittar oss på Åttingsstigen 41 i Halmstad. Kom in och dofta på kryddorna, få personliga recepttips eller hämta dina onlinebeställningar kostnadsfritt.') }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <NuxtLink
            :to="localePath('/oppettider')"
            class="btn bg-brand-500 hover:bg-brand-600 !text-white font-bold border-none rounded-xl gap-2 shadow-xs"
          >
            <Icon name="lucide:clock" class="size-4" />
            <span>{{ t('aboutPage.visit.viewAllHours', 'Se alla öppettider & hitta hit') }}</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Expandable Photo Lightbox Modal -->
    <ClientOnly>
      <Teleport to="body">
        <dialog ref="photoModalRef" class="modal" @close="closePhoto">
          <div v-if="activePhoto" class="modal-box max-w-3xl bg-slate-900 text-white border-2 border-slate-700/80 shadow-2xl p-4 sm:p-6 rounded-3xl space-y-4">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div class="flex items-center gap-2">
                <span class="size-2.5 rounded-full bg-brand-500 inline-block" />
                <h3 class="font-bold text-lg text-white">
                  {{ t(activePhoto.titleKey) }}
                </h3>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-circle btn-sm text-slate-400 hover:text-white hover:bg-slate-800"
                :aria-label="t('aboutPage.gallery.close', 'Stäng')"
                @click="closePhoto"
              >
                <Icon name="lucide:x" class="size-5" />
              </button>
            </div>

            <!-- Enlarged Image -->
            <div class="w-full aspect-16/10 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <img
                :src="activePhoto.imageSrc"
                :alt="activePhoto.alt"
                class="w-full h-full object-contain"
              />
            </div>

            <!-- Modal Footer Description -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs text-slate-400">
              <p class="text-slate-300 leading-relaxed font-medium">
                {{ t(activePhoto.descKey) }}
              </p>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 font-mono text-[11px] shrink-0 border border-slate-700/60">
                <Icon name="lucide:info" class="size-3.5 text-primary" />
                <span>{{ t('aboutPage.gallery.placeholderNote', 'Butiksfoto • Siwar Butik Halmstad') }}</span>
              </div>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop bg-black/75" @click="closePhoto">
            <button type="button" class="sr-only">close</button>
          </form>
        </dialog>
      </Teleport>
    </ClientOnly>

  </div>
</template>
