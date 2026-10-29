<!-- components/SocialMediaShelf.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  type ISocialLink,
  type SocialPlatform,
  getSocialPlatformIcon,
  getSocialPlatformLabel,
} from '~/utils/social'

interface Props {
  links?: ISocialLink[]
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  links: undefined,
  size: 'md',
})

// If links are not passed as a prop, fetch dynamically from public settings endpoint
const { data: settingsData } = props.links === undefined
  ? useFetch<any>('/api/settings', { lazy: true })
  : { data: ref(null) }

// Active social media links sorted by sortOrder
const activeLinks = computed<ISocialLink[]>(() => {
  const source: ISocialLink[] = Array.isArray(props.links)
    ? props.links
    : Array.isArray(settingsData.value?.socialLinks)
      ? settingsData.value.socialLinks
      : []

  return source
    .filter((l) => l && l.isActive !== false && typeof l.url === 'string' && l.url.trim().length > 0)
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return {
        button: 'size-8 rounded-lg',
        icon: 'size-4',
      }
    case 'lg':
      return {
        button: 'size-11 rounded-2xl',
        icon: 'size-6',
      }
    case 'md':
    default:
      return {
        button: 'size-9.5 rounded-xl',
        icon: 'size-4.5',
      }
  }
})
</script>

<template>
  <div v-if="activeLinks.length > 0" class="flex flex-wrap items-center gap-2.5">
    <a
      v-for="link in activeLinks"
      :key="link.platform"
      :href="link.url"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="getSocialPlatformLabel(link.platform)"
      :title="getSocialPlatformLabel(link.platform)"
      :class="[
        sizeClasses.button,
        'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white',
        'border border-slate-700/80 hover:border-brand-500/60',
        'flex items-center justify-center shrink-0',
        'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md shadow-xs',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
      ]"
    >
      <Icon :name="getSocialPlatformIcon(link.platform)" :class="sizeClasses.icon" />
      <span class="sr-only">{{ getSocialPlatformLabel(link.platform) }}</span>
    </a>
  </div>
</template>
