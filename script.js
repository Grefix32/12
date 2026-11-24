import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient('https://ajzxaolddmatbinohmbt.supabase.co', 'sb_publishable_lG60hCmdehMvEXoFeKcuvA_32T-ipq-');
const $ = (selector) => document.querySelector(selector);

const authStatus = $('#auth-status');
const authForms = $('#auth-forms');
const userPanel = $('#user-panel');
const userInfo = $('#user-info');
const status = $('#status');
const list = $('#nodes-list');
const adminPanel = $('#admin-panel');
const formStatus = $('#form-status');
const nodeForm = $('#node-form');
const nodeIdInput = $('#node-id');
const pharmacyNameInput = $('#pharmacy-name');
const ipAddressInput = $('#ip-address');
const saveButton = $('#save-button');
const cancelButton = $('#cancel-button');

let isAdmin = false;
let nodes = [];

function resetNodeForm() {
  nodeForm.reset();
  nodeIdInput.value = '';
  saveButton.textContent = 'Додати вузол';
  cancelButton.hidden = true;
}

function setAdminState(value) {
  isAdmin = value;
  adminPanel.hidden = !value;
  if (!value) resetNodeForm();
}

function showNodes() {
  list.replaceChildren();
  if (nodes.length === 0) {
    status.textContent = 'Записів немає.';
    return;
  }

  for (const node of nodes) {
    const item = document.createElement('li');
    const description = document.createElement('span');
    description.textContent = `${node.pharmacy_name} – ${node.ip_address}`;
    item.append(description);

    if (isAdmin) {
      const actions = document.createElement('div');
      actions.className = 'node-actions';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.textContent = 'Редагувати';
      editButton.addEventListener('click', () => startEditing(node));

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.textContent = 'Видалити';
      deleteButton.addEventListener('click', () => deleteNode(node.id));

      actions.append(editButton, deleteButton);
      item.append(actions);
    }

    list.append(item);
  }

  status.textContent = `Знайдено вузлів: ${nodes.length}`;
}

async function loadNodes() {
  status.textContent = 'Завантаження вузлів мережі...';
  list.replaceChildren();
  try {
    const { data, error } = await db
      .from('pharmacy_nodes')
      .select('id, pharmacy_name, ip_address')
      .order('id', { ascending: true });
    if (error) throw error;
    nodes = data ?? [];
    showNodes();
  } catch (error) {
    console.error('Помилка читання:', error);
    nodes = [];
    status.textContent = 'Не вдалося завантажити вузли мережі.';
  }
}

async function updateAuthState() {
  setAdminState(false);
  userPanel.hidden = true;
  authForms.hidden = true;
  try {
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) {
      authForms.hidden = false;
      authStatus.textContent = 'Вхід не виконано.';
      return;
    }

    userInfo.textContent = `Користувач: ${data.user.email}`;
    userPanel.hidden = false;
    try {
      const { data: result, error: roleError } = await db.rpc('check_admin');
      if (roleError) throw roleError;
      setAdminState(result === true);
      authStatus.textContent = isAdmin
        ? 'Виконано вхід адміністратора.'
        : 'Виконано вхід звичайного користувача.';
    } catch (roleError) {
      console.error('Помилка перевірки ролі:', roleError);
      authStatus.textContent = 'Вхід виконано, але роль не вдалося перевірити.';
    }
  } catch (error) {
    console.error('Помилка автентифікації:', error);
    authForms.hidden = false;
    authStatus.textContent = 'Не вдалося перевірити сеанс.';
  } finally {
    await loadNodes();
  }
}

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  authStatus.textContent = 'Реєстрація...';
  try {
    const { data, error } = await db.auth.signUp({
      email: $('#register-email').value.trim(),
      password: $('#register-password').value
    });
    if (error) throw error;
    form.reset();
    if (data.session) {
      await updateAuthState();
    } else {
      authStatus.textContent = 'Перевірте електронну пошту для підтвердження реєстрації.';
    }
  } catch (error) {
    console.error('Помилка реєстрації:', error);
    authStatus.textContent = 'Не вдалося зареєструвати користувача.';
  } finally {
    button.disabled = false;
  }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  authStatus.textContent = 'Виконується вхід...';
  try {
    const { error } = await db.auth.signInWithPassword({
      email: $('#login-email').value.trim(),
      password: $('#login-password').value
    });
    if (error) throw error;
    form.reset();
    await updateAuthState();
  } catch (error) {
    console.error('Помилка входу:', error);
    authStatus.textContent = 'Не вдалося виконати вхід.';
  } finally {
    button.disabled = false;
  }
});

$('#logout-button').addEventListener('click', async () => {
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    await updateAuthState();
  } catch (error) {
    console.error('Помилка виходу:', error);
    authStatus.textContent = 'Не вдалося завершити сеанс.';
  }
});

function startEditing(node) {
  if (!isAdmin) return;
  nodeIdInput.value = String(node.id);
  pharmacyNameInput.value = node.pharmacy_name;
  ipAddressInput.value = node.ip_address;
  saveButton.textContent = 'Зберегти зміни';
  cancelButton.hidden = false;
  formStatus.textContent = `Редагування вузла № ${node.id}`;
}

cancelButton.addEventListener('click', () => {
  resetNodeForm();
  formStatus.textContent = '';
});

nodeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const pharmacy_name = pharmacyNameInput.value.trim();
  const ip_address = ipAddressInput.value.trim();
  const nodeId = nodeIdInput.value;
  if (!pharmacy_name || !ip_address || pharmacy_name.length > 150 || ip_address.length > 150) {
    formStatus.textContent = 'Перевірте назву аптеки та IP-адресу.';
    return;
  }
  saveButton.disabled = true;
  formStatus.textContent = 'Збереження запису...';
  try {
    const query = nodeId
      ? db.from('pharmacy_nodes').update({ pharmacy_name, ip_address }).eq('id', Number(nodeId))
      : db.from('pharmacy_nodes').insert({ pharmacy_name, ip_address });
    const { error } = await query;
    if (error) throw error;
    resetNodeForm();
    await loadNodes();
    formStatus.textContent = nodeId ? 'Зміни збережено.' : 'Вузол додано.';
  } catch (error) {
    console.error('Помилка збереження:', error);
    formStatus.textContent = 'Не вдалося зберегти запис.';
  } finally {
    saveButton.disabled = false;
  }
});

async function deleteNode(nodeId) {
  if (!isAdmin || !confirm('Видалити вибраний вузол мережі?')) return;
  formStatus.textContent = 'Видалення вузла...';
  try {
    const { error } = await db.from('pharmacy_nodes').delete().eq('id', nodeId);
    if (error) throw error;
    await loadNodes();
    formStatus.textContent = 'Вузол видалено.';
  } catch (error) {
    console.error('Помилка видалення:', error);
    formStatus.textContent = 'Не вдалося видалити вузол.';
  }
}

await updateAuthState();
