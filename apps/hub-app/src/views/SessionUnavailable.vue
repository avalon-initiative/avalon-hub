<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AvalonAuthCard, AvalonButton } from '@avalon-initiative/common-ui'
import { useSessionStore } from '../api/session'
import AuthLayout from './AuthLayout.vue'
import styles from '../styles/SessionUnavailable.module.scss'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const retrying = ref(false)

async function retry() {
  retrying.value = true
  await session.initialize()
  retrying.value = false
  if (session.isAuthenticated()) await router.push(String(route.query.redirect ?? '/home'))
  else if (!session.resumeFailed) await router.push({ name: 'login' })
}
</script>

<template>
  <AuthLayout>
    <AvalonAuthCard title="Can't reach Avalon" subtitle="You are still signed in. The server did not answer.">
      <p :class="styles.message">Your session is kept on this device. Try again in a moment.</p>
      <AvalonButton :label="retrying ? 'Retrying...' : 'Try again'" :disabled="retrying" @click="retry" />
    </AvalonAuthCard>
  </AuthLayout>
</template>
