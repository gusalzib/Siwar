<!-- components/BaseModal.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'

interface Props {
  isOpen: boolean
  title?: string
  subtitle?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | string
  showCloseButton?: boolean
  closeOnBackdrop?: boolean
  panelClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  subtitle: '',
  maxWidth: 'md',
  showCloseButton: true,
  closeOnBackdrop: true,
  panelClass: '',
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

const maxWidthClass = computed(() => {
  switch (props.maxWidth) {
    case 'sm':
      return 'max-w-sm'
    case 'md':
      return 'max-w-md'
    case 'lg':
      return 'max-w-lg'
    case 'xl':
      return 'max-w-xl'
    case '2xl':
      return 'max-w-2xl'
    case '3xl':
      return 'max-w-3xl'
    default:
      return props.maxWidth || 'max-w-md'
  }
})

function openDialog() {
  if (dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal()
  }
}

function closeDialog() {
  if (dialogRef.value && dialogRef.value.open) {
    dialogRef.value.close()
  }
}

function handleClose() {
  closeDialog()
  emit('close')
}

function handleNativeClose() {
  if (props.isOpen) {
    emit('close')
  }
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    handleClose()
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      openDialog()
    } else {
      closeDialog()
    }
  }
)

onMounted(() => {
  if (props.isOpen) {
    openDialog()
  }
})

onBeforeUnmount(() => {
  closeDialog()
})

defineExpose({
  dialogRef,
  open: openDialog,
  close: closeDialog,
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <dialog
        ref="dialogRef"
        class="modal"
        @close="handleNativeClose"
      >
        <div
          :class="[
            'modal-box bg-base-100 dark:bg-base-200 border-2 border-slate-200 dark:border-zinc-700/80 shadow-2xl p-6 sm:p-7 rounded-3xl space-y-5 text-base-content relative overflow-hidden',
            maxWidthClass,
            panelClass
          ]"
        >
          <!-- Header (Custom Slot or Default Header) -->
          <slot name="header" :close="handleClose">
            <div v-if="title || showCloseButton" class="flex items-start justify-between gap-3">
              <div class="space-y-1 flex-1">
                <h3 v-if="title" class="font-extrabold text-lg text-base-content leading-snug">
                  {{ title }}
                </h3>
                <p v-if="subtitle" class="text-xs text-base-content/60 font-mono">
                  {{ subtitle }}
                </p>
              </div>

              <button
                v-if="showCloseButton"
                type="button"
                class="btn btn-ghost btn-sm btn-circle text-base-content/60 hover:text-base-content hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
                title="Stäng"
                aria-label="Stäng dialogruta"
                @click="handleClose"
              >
                <Icon name="lucide:x" class="size-5" />
              </button>
            </div>
          </slot>

          <!-- Main Body Content -->
          <slot :close="handleClose" />

          <!-- Footer Actions (Optional Slot) -->
          <div v-if="$slots.footer" class="pt-4 border-t border-slate-200 dark:border-zinc-800">
            <slot name="footer" :close="handleClose" />
          </div>
        </div>

        <!-- Accessible Backdrop with Click-to-Close -->
        <form method="dialog" class="modal-backdrop bg-black/60 backdrop-blur-xs" @click.prevent="handleBackdropClick">
          <button type="button" class="sr-only">close</button>
        </form>
      </dialog>
    </Teleport>
  </ClientOnly>
</template>
