<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'authenticated'): void
}>()

// Use v-model for open state
const isOpen = useVModel(props, 'open', emit)
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!password.value) return
  
  loading.value = true
  error.value = ''

  try {
    await $fetch('/api/docker/auth', {
      method: 'POST',
      body: { password: password.value }
    })
    
    // Success
    isOpen.value = false
    emit('authenticated')
    password.value = '' // clear password
  } catch (e: any) {
    error.value = e.data?.statusMessage || 'Invalid password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Authentication Required</DialogTitle>
        <DialogDescription>
          Enter the docker control password to perform this action.
        </DialogDescription>
      </DialogHeader>
      
      <form @submit.prevent="handleSubmit" class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="Enter password..." 
            class="w-full"
            auto-focus
          />
          <p v-if="error" class="text-xs text-destructive font-medium">{{ error }}</p>
        </div>
        
        <DialogFooter>
          <Button type="button" variant="outline" @click="isOpen = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="loading">
            <Icon name="i-lucide-loader-2" v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
            Authenticate
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
