<script setup lang="ts">
import { ref } from 'vue'
import { shortId } from '../utils/identity'
import styles from '../styles/ShortIdentityId.module.scss'

const props = defineProps<{ id: string }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.id)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // Clipboard unavailable; the full id is still in the tooltip.
  }
}
</script>

<template>
  <button type="button" :class="styles.id" :title="copied ? 'Copied' : `${id} (click to copy)`" @click="copy">
    {{ shortId(id) }}
  </button>
</template>
