<script setup>
import { ref, onMounted } from 'vue'
import api, { errMsg } from '../../api'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  showCreate: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'update:modelValue'
])

const projects = ref([])

const loading = ref(false)
const error = ref('')

const showCreateModal = ref(false)

const newProjectName = ref('')
const creating = ref(false)
const createError = ref('')

/* =========================
   Load Projects
========================= */

async function loadProjects() {
  loading.value = true
  error.value = ''

  try {
    const res = await api.get(
      '/api/resource/Project',
      {
        params: {
          fields: JSON.stringify([
            'name',
            'project_name',
            'status'
          ]),

          filters: JSON.stringify([
            ['status', '=', 'Open']
          ]),

          order_by: 'project_name asc',

          limit_page_length: 100
        }
      }
    )

    projects.value = res.data.data

  } catch (e) {
    error.value = errMsg(
      e,
      'Could not load Projects'
    )
  } finally {
    loading.value = false
  }
}

/* =========================
   Select Project
========================= */

function selectProject(event) {
  emit(
    'update:modelValue',
    event.target.value
  )
}

/* =========================
   Create Project
========================= */

function openCreateModal() {
  newProjectName.value = ''
  createError.value = ''
  showCreateModal.value = true
}

function closeCreateModal() {
  if (creating.value) {
    return
  }

  showCreateModal.value = false
}

async function createProject() {
  createError.value = ''

  const projectName =
    newProjectName.value.trim()

  if (!projectName) {
    createError.value =
      'Please enter a Project name'

    return
  }

  creating.value = true

  try {
    const res = await api.post(
      '/api/resource/Project',
      {
        project_name: projectName,
        status: 'Open'
      }
    )

    const project =
      res.data.data

    await loadProjects()

    emit(
      'update:modelValue',
      project.name
    )

    newProjectName.value = ''
    showCreateModal.value = false

  } catch (e) {
    createError.value = errMsg(
      e,
      'Could not create Project'
    )
  } finally {
    creating.value = false
  }
}

/* =========================
   Initial Load
========================= */

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <div class="project-selector">

    <select
      :value="modelValue"
      :disabled="loading"
      @change="selectProject"
    >

      <option value="">
        {{
          loading
            ? 'Loading Projects...'
            : 'Select Project'
        }}
      </option>

      <option
        v-for="project in projects"
        :key="project.name"
        :value="project.name"
      >
        {{ project.project_name || project.name }}
      </option>

    </select>

    <button
      v-if="showCreate"
      type="button"
      class="create-project-btn"
      @click="openCreateModal"
    >
      + Create Project
    </button>

    <span
      v-if="error"
      class="project-error"
    >
      {{ error }}
    </span>

  </div>

  <!-- Create Project Modal -->

  <div
    v-if="showCreateModal"
    class="project-modal-overlay"
    @click.self="closeCreateModal"
  >

    <div class="project-modal">

      <div class="project-modal-header">

        <div>
          <h3>
            Create Project
          </h3>

          <p>
            Add a project that can be used
            in Timesheets.
          </p>
        </div>

        <button
          type="button"
          class="close-btn"
          @click="closeCreateModal"
        >
          ×
        </button>

      </div>

      <div class="project-modal-field">

        <label>
          Project Name
        </label>

        <input
          v-model="newProjectName"
          type="text"
          placeholder="e.g. HRMS Portal"
          @keyup.enter="createProject"
        />

      </div>

      <div
        v-if="createError"
        class="project-create-error"
      >
        {{ createError }}
      </div>

      <div class="project-modal-actions">

        <button
          type="button"
          class="cancel-btn"
          @click="closeCreateModal"
        >
          Cancel
        </button>

        <button
          type="button"
          class="save-btn"
          :disabled="creating"
          @click="createProject"
        >
          {{
            creating
              ? 'Creating...'
              : 'Create Project'
          }}
        </button>

      </div>

    </div>

  </div>
</template>

<style scoped>

.project-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.project-selector select {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.project-selector select:focus {
  border-color: var(--accent);
}

.project-selector select:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.create-project-btn {
  width: fit-content;
  border: none;
  background: transparent;
  color: var(--accent);
  padding: 0;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.create-project-btn:hover {
  color: var(--accent-dark);
}

.project-error {
  color: var(--red);
  font-size: 12px;
}

/* Modal */

.project-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 22, 59, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.project-modal {
  width: min(440px, 100%);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 24px;
  box-shadow: var(--shadow);
}

.project-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 22px;
}

.project-modal-header h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.project-modal-header p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.project-modal-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.project-modal-field label {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
}

.project-modal-field input {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  outline: none;
  font-size: 13px;
}

.project-modal-field input:focus {
  border-color: var(--accent);
}

.project-create-error {
  margin-top: 10px;
  color: var(--red);
  font-size: 12px;
}

.project-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.project-modal-actions button {
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.project-modal-actions .cancel-btn {
  background: #f1f1f5;
  color: var(--text);
}

.project-modal-actions .save-btn {
  background: var(--accent);
  color: white;
}

.project-modal-actions .save-btn:hover {
  background: var(--accent-dark);
}

.project-modal-actions .save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>