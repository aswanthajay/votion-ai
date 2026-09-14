import {
    WEBLLM_MODEL_CONFIGS,
    checkModelInCache,
    deleteWebLlmModelCache,
    deleteAllWebLlmModelCaches,
    isWebGpuSupported,
} from '../lab/lib/webllmEngine.js'

function formatBytes(bytes) {
    if (! bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function registerDownloadedModelsManager(Alpine) {
    Alpine.data('downloadedModelsManager', () => ({
        loading: true,
        webGpuAvailable: false,
        storageUsage: null,
        storageQuota: null,
        deletingId: null,
        deletingAll: false,
        toastMessage: '',
        toastTimeout: null,
        models: Object.entries(WEBLLM_MODEL_CONFIGS).map(([id, conf]) => ({
            id,
            label: conf.displayName,
            mlcModelId: conf.mlcModelId,
            vram: conf.vram,
            download: conf.download,
            description: conf.description,
            isDownloaded: false,
            checking: false,
        })),

        get anyDownloaded() {
            return this.models.some((m) => m.isDownloaded)
        },

        get downloadedCount() {
            return this.models.filter((m) => m.isDownloaded).length
        },

        async init() {
            this.webGpuAvailable = isWebGpuSupported()
            await this.refresh()
        },

        async refresh() {
            this.loading = true
            await Promise.all([
                this.updateStorageEstimate(),
                this.checkDownloadedStatus(),
            ])
            this.loading = false
        },

        async updateStorageEstimate() {
            try {
                if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
                    const estimate = await navigator.storage.estimate()
                    this.storageUsage = formatBytes(estimate.usage || 0)
                    this.storageQuota = formatBytes(estimate.quota || 0)
                }
            } catch {}
        },

        async checkDownloadedStatus() {
            const checks = this.models.map(async (model) => {
                model.checking = true
                try {
                    model.isDownloaded = await checkModelInCache(model.id)
                } catch {
                    model.isDownloaded = false
                } finally {
                    model.checking = false
                }
            })
            await Promise.all(checks)
        },

        showToast(msg) {
            this.toastMessage = msg
            if (this.toastTimeout) clearTimeout(this.toastTimeout)
            this.toastTimeout = setTimeout(() => {
                this.toastMessage = ''
            }, 3500)
        },

        async deleteModel(modelId) {
            const model = this.models.find((m) => m.id === modelId)
            if (! model) return

            this.deletingId = modelId
            try {
                await deleteWebLlmModelCache(modelId)
                model.isDownloaded = false
                await this.updateStorageEstimate()
                this.showToast(`${model.label} removed from browser storage.`)
            } catch (err) {
                console.error(err)
                this.showToast(`Failed to delete ${model.label}.`)
            } finally {
                this.deletingId = null
            }
        },

        async deleteAll() {
            if (! confirm('Are you sure you want to delete all downloaded WebGPU models from this browser? This will free up local disk space.')) {
                return
            }

            this.deletingAll = true
            try {
                await deleteAllWebLlmModelCaches()
                this.models.forEach((m) => {
                    m.isDownloaded = false
                })
                await this.updateStorageEstimate()
                this.showToast('All downloaded models have been cleared from browser storage.')
            } catch (err) {
                console.error(err)
                this.showToast('Failed to delete some model caches.')
            } finally {
                this.deletingAll = false
            }
        },
    }))
}
