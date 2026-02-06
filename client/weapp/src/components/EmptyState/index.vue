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
  <view class="rounded-xl bg-card p-5">
    <t-empty :title="title" :description="description" />
    <view v-if="props.actionText" class="mt-4 flex justify-center">
      <t-button theme="primary" variant="outline" size="small" @tap="onAction">
        {{ props.actionText }}
      </t-button>
    </view>
  </view>
</template>
