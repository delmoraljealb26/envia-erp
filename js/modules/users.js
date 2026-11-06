/* =========================================================================
   ENVIA ERP · modules/users.js
   Administración de usuarios del ERP y matriz de roles (RBAC).
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const ROLE_DESC = {
    SuperAdmin: 'Acceso ilimitado a todos los módulos, configuración, usuarios y sincronización.',
    'Contador / Fiscal': 'Contabilidad, tributos, libros SENIAT, cuentas por pagar y maestros.',
    'Tesorero / Cuentas por Pagar': 'Pagos, proveedores, liquidaciones, maestros y consulta tributaría.',
    'Auditor / Operaciones': 'Consulta de todos los módulos financieros y operativos en modo solo lectura.'
  };

  const ROLE_ICON = { SuperAdmin: 'shield', 'Contador / Fiscal': 'book', 'Tesorero / Cuentas por Pagar': 'wallet', 'Auditor / Operaciones': 'eye' };

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const canWrite = NS.app.canWrite();
    const counts = {};
    NS.store.ROLES.forEach((r) => { counts[r] = db.users.filter((u) => u.rol === r).length; });

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Seguridad · control de acceso basado en roles</span>
          <h2 class="page-title">Usuarios del ERP</h2>
          <p class="page-sub">${db.users.length} usuarios · ${db.users.filter((u) => u.activo).length} activos · 4 roles con permisos diferenciados.</p>
        </div>
        <div class="page-actions">
          ${canWrite ? `<button class="btn btn-primary" id="user-new">${ui.icon('plus', 16)} Nuevo usuario</button>` : ''}
        </div>
      </div>

      <div class="role-grid">
        ${NS.store.ROLES.map((r) => `<article class="role-card">
          <span class="role-ico">${ui.icon(ROLE_ICON[r], 20)}</span>
          <div class="role-body"><strong>${ui.esc(r)}</strong><p>${ui.esc(ROLE_DESC[r])}</p><span class="role-count">${counts[r]} usuario${counts[r] === 1 ? '' : 's'}</span></div>
        </article>`).join('')}
      </div>

      <section class="card card-flush">
        <div class="card-head card-head-pad"><div><h3>Cuentas de acceso</h3><p>Claves gestionadas localmente · en producción se recomienda Supabase Auth</p></div><span class="chip chip-navy">${ui.icon('lock', 13)} sessionStorage</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Creación</th><th class="actions-col"></th></tr></thead>
            <tbody>${db.users.map((u) => `<tr>
              <td><div class="user-cell">${ui.avatar(u.nombre, 34)}<div><strong class="mono">${ui.esc(u.usuario)}</strong>${u.usuario === 'ENVIA' ? '<small class="block text-orange">Cuenta maestra</small>' : ''}</div></div></td>
              <td>${ui.esc(u.nombre)}</td>
              <td>${ui.esc(u.correo)}</td>
              <td>${ui.badge(u.rol, 'purple')}</td>
              <td>${ui.badge(u.activo ? 'Activo' : 'Inactivo', u.activo ? 'success' : 'danger')}</td>
              <td>${ui.date(u.created_at)}</td>
              <td class="actions-col">
                ${canWrite ? `<button class="icon-btn" data-edit-user="${ui.esc(u.id)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                ${canWrite ? `<button class="icon-btn" data-reset-user="${ui.esc(u.id)}" title="Cambiar clave">${ui.icon('key', 16)}</button>` : ''}
                ${canWrite && u.usuario !== 'ENVIA' ? `<button class="icon-btn danger" data-del-user="${ui.esc(u.id)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Matriz de permisos por rol</h3><p>Control de acceso por módulo y capacidad de escritura</p></div></div>
        <div class="table-wrap">
          <table class="data-table permission-table">
            <thead><tr><th>Módulo</th>${NS.store.ROLES.map((r) => `<th class="center">${ui.esc(r)}</th>`).join('')}</tr></thead>
            <tbody>${Object.keys(NS.app.MODULES).map((m) => `<tr><td>${ui.esc(NS.app.MODULES[m].label)}</td>${NS.store.ROLES.map((r) => {
              const access = NS.store.accessFor(r);
              const ok = access.modules.includes('*') || access.modules.includes(m);
              return `<td class="center">${ok ? `<span class="perm-ok">${ui.icon('check', 13)}</span>` : `<span class="perm-no">${ui.icon('x', 13)}</span>`}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="card-foot-note">${ui.icon('shield', 14)} SuperAdmin posee escritura total. Auditor / Operaciones accede a los módulos en modo consulta. Los roles Contador y Tesorero tienen escritura sobre sus áreas.</div>
      </section>
    `;

    $('#user-new').addEventListener('click', () => openForm());
    view.querySelectorAll('[data-edit-user]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.editUser)));
    view.querySelectorAll('[data-reset-user]').forEach((b) => b.addEventListener('click', () => resetPassword(b.dataset.resetUser)));
    view.querySelectorAll('[data-del-user]').forEach((b) => b.addEventListener('click', () => askDelete(b.dataset.delUser)));
  }

  function openForm(id) {
    const ui = NS.ui;
    if (!NS.app.canWrite()) return ui.toast('Solo SuperAdmin puede administrar usuarios.', 'warning');
    const u = id ? NS.store.db.users.find((x) => x.id === id) : null;
    const isMaster = u && u.usuario === 'ENVIA';
    const overlay = ui.modal({
      title: u ? 'Editar usuario' : 'Nuevo usuario del ERP',
      eyebrow: 'Seguridad · RBAC',
      size: 'md',
      body: `<form id="user-form" class="form-grid">
        <label class="field"><span>Usuario *</span><input name="usuario" value="${ui.esc(u ? u.usuario : '')}" placeholder="nombre.usuario" ${u ? 'disabled' : ''} required><small>Sin espacios. Se almacena en mayúsculas.</small></label>
        <label class="field"><span>Nombre completo *</span><input name="nombre" value="${ui.esc(u ? u.nombre : '')}" placeholder="Nombre y apellido" required></label>
        <label class="field"><span>Correo corporativo *</span><input name="correo" type="email" value="${ui.esc(u ? u.correo : '')}" placeholder="usuario@envia.com.ve" required></label>
        <label class="field"><span>Rol *</span><select name="rol" ${isMaster ? 'disabled' : ''}>${NS.store.ROLES.map((r) => `<option ${u && u.rol === r ? 'selected' : ''}>${ui.esc(r)}</option>`).join('')}</select></label>
        <label class="field field-full"><span>${u ? 'Nueva clave (dejar vacío para conservar)' : 'Clave de acceso *'}</span><input name="password" type="password" autocomplete="new-password" ${u ? '' : 'required'} placeholder="Mínimo 6 caracteres"><small>La clave se guarda localmente en esta demostración. En producción usa Supabase Auth.</small></label>
        <label class="field"><span>Estado</span><select name="activo"><option value="true" ${!u || u.activo ? 'selected' : ''}>Activo</option><option value="false" ${u && !u.activo ? 'selected' : ''}>Inactivo</option></select></label>
        <p class="form-note field-full">${ui.icon('shield', 14)} El rol define los módulos visibles y si puede crear, editar o eliminar. El usuario maestro ENVIA conserva siempre SuperAdmin.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="user-save">${ui.icon('check', 15)} Guardar usuario</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#user-save').addEventListener('click', () => {
      const form = overlay.querySelector('#user-form');
      if (!form.reportValidity()) return;
      const data = {
        usuario: u ? u.usuario : form.elements.usuario.value.trim(),
        nombre: form.elements.nombre.value,
        correo: form.elements.correo.value,
        rol: isMaster ? 'SuperAdmin' : form.elements.rol.value,
        activo: form.elements.activo.value === 'true'
      };
      const pass = form.elements.password.value;
      if (pass) {
        if (pass.length < 6) return ui.toast('La clave debe tener al menos 6 caracteres.', 'error');
        data.password = pass;
      } else if (u) data.password = u.password;
      if (!u && !data.password) return ui.toast('Debes asignar una clave.', 'error');
      if (!ui.validEmail(data.correo)) return ui.toast('El correo no es válido.', 'error');
      try {
        NS.store.upsertUser({ ...data, id: u ? u.id : undefined });
        ui.closeModal(overlay);
        ui.toast(u ? 'Usuario actualizado.' : 'Usuario creado con acceso al ERP.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function resetPassword(id) {
    const ui = NS.ui;
    const u = NS.store.db.users.find((x) => x.id === id);
    if (!u) return;
    const overlay = ui.modal({
      title: 'Cambiar clave de acceso',
      eyebrow: u.usuario,
      size: 'sm',
      body: `<form id="reset-form" class="form-grid">
        <label class="field field-full"><span>Nueva clave *</span><input name="password" type="password" minlength="6" placeholder="Mínimo 6 caracteres" required></label>
        <label class="field field-full"><span>Confirmar clave *</span><input name="confirm" type="password" minlength="6" required></label>
        <p class="form-note field-full">${ui.icon('alert', 14)} La sesión activa del usuario no se cierra automáticamente.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="reset-save">${ui.icon('key', 15)} Actualizar clave</button>`
    });
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#reset-save').addEventListener('click', () => {
      const form = overlay.querySelector('#reset-form');
      if (!form.reportValidity()) return;
      if (form.elements.password.value !== form.elements.confirm.value) return ui.toast('Las claves no coinciden.', 'error');
      NS.store.upsertUser({ ...u, password: form.elements.password.value });
      ui.closeModal(overlay);
      ui.toast('Clave actualizada correctamente.', 'success');
    });
  }

  function askDelete(id) {
    const ui = NS.ui;
    const u = NS.store.db.users.find((x) => x.id === id);
    if (!u) return;
    ui.confirm({ title: 'Eliminar usuario', message: `Se eliminará el acceso de ${u.nombre} (${u.usuario}). ¿Continuar?`, confirmText: 'Eliminar', danger: true }).then((ok) => {
      if (!ok) return;
      try { NS.store.deleteUser(id); ui.toast('Usuario eliminado.', 'success'); NS.app.refresh(true); }
      catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  NS.modules.users = { render };
})();
