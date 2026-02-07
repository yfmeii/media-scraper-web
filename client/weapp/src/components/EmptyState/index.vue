<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    actionText?: string
  }>(),
  {
    description: '',
    actionText: '',
  },
)

const emit = defineEmits<{
  (e: 'action'): void
}>()

defineComponentJson({
  styleIsolation: 'apply-shared',
})

function onAction() {
  emit('action')
}
</script>

<template>
  <view class="rounded-xl bg-card py-8 px-5 flex flex-col items-center">
    <view class="text-sm text-foreground font-medium">{{ title }}</view>
    <view v-if="description" class="mt-1 text-xs text-muted-foreground">{{ description }}</view>
    <view v-if="props.actionText" class="mt-4">
      <t-button theme="primary" variant="outline" size="small" @tap="onAction">{{ props.actionText }}</t-button>
    </view>
  </view>
</template>
