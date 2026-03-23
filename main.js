/* COUNTDOWN */
(function () {
    const target = new Date('2026-03-28T10:00:00-03:00');
    const pad = n => String(n).padStart(2, '0');
    function tick() {
        const diff = target - new Date();
        if (diff <= 0) {
            ['days', 'hours', 'mins', 'secs'].forEach(id => {
                const el = document.getElementById('cd-' + id);
                if (el) el.textContent = '00';
            });
            return;
        }
        document.getElementById('cd-days').textContent = pad(Math.floor(diff / 86400000));
        document.getElementById('cd-hours').textContent = pad(Math.floor((diff % 86400000) / 3600000));
        document.getElementById('cd-mins').textContent = pad(Math.floor((diff % 3600000) / 60000));
        document.getElementById('cd-secs').textContent = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    setInterval(tick, 1000);
})();

/* APPS SCRIPT — URL del backend */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyy7LXYBA9qngdcRBIK_CMk9MEP9eO4LWY8NmH1sR4_F_gJvqnxwLs6rZqT11oWgaj7/exec';

/* BARRA DE PROGRESO — carga el conteo real desde Apps Script */
const TOTAL_PASSES = 300;

async function updateProgress() {
    try {
        const res  = await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'cors' });
        const data = await res.json();
        if (!data.success) return;

        const count   = data.count  || 0;
        const total   = data.total  || TOTAL_PASSES;
        const pct     = Math.min((count / total) * 100, 100);

        const bar     = document.getElementById('progressBar');
        const label   = document.getElementById('progressCount');
        if (bar)   bar.style.width = pct + '%';
        if (label) label.textContent = count + '/' + total;

    } catch (e) {
        // Silencioso si falla (no bloquea nada)
    }
}

// Cargar conteo al abrir la página
updateProgress();

document.getElementById('mainForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn     = document.getElementById('submitBtn');
    const form    = e.target;
    const errorEl = document.getElementById('formError');

    if (errorEl) errorEl.style.display = 'none';
    btn.classList.add('loading');
    btn.disabled = true;

    const payload = {
        nombre:    form.nombre.value.trim(),
        email:     form.email.value.trim(),
        telefono:  form.telefono.value.trim(),
        novedades: form.novedades.checked,
    };

    try {
        await fetch(APPS_SCRIPT_URL, {
            method:  'POST',
            mode:    'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body:    JSON.stringify(payload),
        });

        form.reset();
        document.getElementById('successOverlay').classList.add('active');
        setTimeout(updateProgress, 1500);

    } catch (err) {
        console.error('Error al enviar el formulario:', err);
        if (errorEl) {
            errorEl.textContent = 'Hubo un problema al registrar tu turno. Intentá de nuevo en unos segundos.';
            errorEl.style.display = 'block';
        }
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
});

document.getElementById('btnCloseSuccess').addEventListener('click', function () {
    document.getElementById('successOverlay').classList.remove('active');
});

/* SCROLL REVEAL */
const observer = new IntersectionObserver((entries) => {
    entries.forEach(el => {
        if (el.isIntersecting) setTimeout(() => el.target.classList.add('visible'), +(el.target.dataset.delay || 0));
    });
}, { threshold: 0.08 });
document.querySelectorAll('.pass-card').forEach((el, i) => { el.dataset.delay = i * 100; observer.observe(el); });
document.querySelectorAll('.benefit-item').forEach((el, i) => { el.dataset.delay = i * 80; observer.observe(el); });
document.querySelectorAll('.catalog-card').forEach((el, i) => { el.dataset.delay = i * 100; observer.observe(el); });
