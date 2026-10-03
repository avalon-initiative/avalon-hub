<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { AvalonAuthCard, AvalonForm, AvalonTextField } from '@avalon-initiative/common-ui'
import { isIdentityId } from '@avalon-initiative/protocol-sdk'
import { avalonClient, useSessionStore } from '../api/session'
import { loadSigningKeySeed } from '../api/signingKeyStorage'
import AuthLayout from './AuthLayout.vue'
import styles from '../styles/CreateIdentity.module.scss'

const router = useRouter()
const session = useSessionStore()

const identityId = ref('')
const submitting = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  const id = identityId.value.trim()
  if (!isIdentityId(id)) {
    error.value = 'Enter a valid identity id: 64 lowercase hex characters.'
    return
  }
  submitting.value = true
  try {
    const accountSession = await avalonClient().loginWithIdentityId(id)
    // The reconnect-across-nodes signing key, when this
    // device already holds one for this identity — a brand-new device
    // that hasn't been granted one yet simply logs in without it.
    const secretKey = loadSigningKeySeed(id)
    if (secretKey) await accountSession.attachSigningKey(secretKey)
    session.setSession(accountSession)
    await router.push({ name: 'home' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <AvalonAuthCard title="Welcome to Avalon" subtitle="Your identity and community, connected across the internet.">
      <p v-if="session.staleSessionCleared" :class="styles.hint">
        You were signed out because Avalon's identity ids changed format. Please log in again with your new identity id.
      </p>
      <AvalonForm submit-label="Log in with passkey" :submitting="submitting" :error="error" @submit="onSubmit">
        <AvalonTextField v-model="identityId" label="Identity id" placeholder="Your identity id" />
      </AvalonForm>
      <p :class="styles.switchLink">
        <RouterLink to="/create-identity">Don't have an identity yet? Create one</RouterLink>
      </p>
      <p :class="styles.switchLink">
        <RouterLink to="/recover-identity">Lost every device? Recover your identity</RouterLink>
      </p>
    </AvalonAuthCard>
  </AuthLayout>
</template>
