document.getElementById('account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const action = event.submitter.value;
  const data = Object.fromEntries(new FormData(form));
  const error = document.getElementById('account-error');
  error.textContent = '';
  if (action === 'register' && data.name.trim().length < 2) {
    error.textContent = 'Informe seu nome para criar uma conta.';
    return;
  }
  if (action === 'register' && data.password.length < 10) {
    error.textContent = 'A senha deve ter pelo menos 10 caracteres.';
    return;
  }
  form.querySelectorAll('button').forEach(button => button.disabled = true);
  try {
    const response = await fetch('/api/auth/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível acessar sua conta.');
    window.location.replace('/');
  } catch (err) {
    error.textContent = err.message;
  } finally {
    form.querySelectorAll('button').forEach(button => button.disabled = false);
  }
});