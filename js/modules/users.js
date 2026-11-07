/* =========================================================================
   ENVIA ERP · modules/users.js
   Usuarios del sistema, roles personalizados y matriz granular de permisos.
   ========================================================================= */
(function () {
  'use strict';
  const NS = (window.ENVIA = window.ENVIA || {});
  NS.modules = NS.modules || {};

  const ROLE_ICON = { SuperAdmin: 'shield', 'Contador / Fiscal': 'book', 'Tesorero / Cuentas por Pagar': 'wallet', 'Auditor / Operaciones': 'eye' };
  const ICON_OPTIONS = ['shield', 'book', 'wallet', 'eye', 'users', 'settings', 'activity', 'grid'];
  let filters = { q: '' };

  function roleIcon(role) { return role.icono || ROLE_ICON[role.nombre] || 'shield'; }
  function catalog() { return NS.store.PERMISSION_CATALOG; }

  function render(view) {
    const ui = NS.ui;
    const db = NS.store.db;
    const roles = NS.store.roles();
    const counts = {};
    roles.forEach((r) => { counts[r.nombre] = db.users.filter((u) => u.rol === r.nombre).length; });
    const canCreate = NS.app.canAction('users', 'crear');
    const canEdit = NS.app.canAction('users', 'editar');
    const canDelete = NS.app.canAction('users', 'eliminar');
    const canRoles = NS.app.canAction('users', 'roles');

    view.innerHTML = `
      <div class="page-head">
        <div>
          <span class="eyebrow">Seguridad · control de acceso basado en roles</span>
          <h2 class="page-title">Usuarios del sistema</h2>
          <p class="page-sub">${db.users.length} usuarios · ${db.users.filter((u) => u.activo).length} activos · ${roles.length} roles con permisos por módulo, pestaña y acción.</p>
        </div>
        <div class="page-actions">
          <div class="search-box">${ui.icon('search', 17)}<input id="user-search" type="search" placeholder="Buscar por usuario, nombre o correo..." value="${ui.esc(filters.q)}"></div>
          ${NS.reports.button('users')}
          ${canRoles ? `<button class="btn btn-ghost" id="role-new">${ui.icon('shield', 16)} Nuevo rol</button>` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="user-new">${ui.icon('plus', 16)} Nuevo usuario</button>` : ''}
        </div>
      </div>

      <div class="role-grid">
        ${roles.map((r) => `<article class="role-card ${r.admin ? 'super' : ''}">
          <span class="role-ico">${ui.icon(roleIcon(r), 20)}</span>
          <div class="role-body"><strong>${ui.esc(r.nombre)}</strong><p>${ui.esc(r.descripcion || 'Rol personalizado del sistema')}</p><span class="role-count">${counts[r.nombre] || 0} usuario${counts[r.nombre] === 1 ? '' : 's'}</span></div>
          ${canRoles ? `<div class="role-card-actions">
            ${r.nombre === 'SuperAdmin' ? '' : `<button class="icon-btn" data-edit-role="${ui.esc(r.nombre)}" title="Editar permisos">${ui.icon('edit', 14)}</button>`}
            ${r.sistema || r.admin ? '' : `<button class="icon-btn danger" data-del-role="${ui.esc(r.nombre)}" title="Eliminar rol">${ui.icon('trash', 14)}</button>`}
          </div>` : ''}
        </article>`).join('')}
      </div>

      <section class="card card-flush">
        <div class="card-head card-head-pad"><div><h3>Cuentas de acceso</h3><p>Claves gestionadas localmente · en producción se recomienda Supabase Auth</p></div><span class="chip chip-navy">${ui.icon('lock', 13)} sessionStorage</span></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Permisos</th><th>Estado</th><th>Creación</th><th class="actions-col"></th></tr></thead>
            <tbody>${db.users.filter((u) => { const hay = [u.usuario, u.nombre, u.correo].join(' ').toLowerCase(); return !filters.q || hay.includes(filters.q); }).map((u) => `<tr>
              <td><div class="user-cell"><span class="cell-link" data-user="${ui.esc(u.id)}">${ui.avatar(u.nombre, 34)}<div><strong class="mono">${ui.esc(u.usuario)}</strong>${u.usuario === 'ENVIA' ? '<small class="block text-orange">Cuenta maestra</small>' : ''}</div></div></span></td>
              <td>${ui.esc(u.nombre)}</td>
              <td>${ui.esc(u.correo)}</td>
              <td>${ui.badge(u.rol, 'purple')}</td>
              <td>${u.permisos ? '<span class="chip chip-orange">Personalizados</span>' : '<span class="chip chip-navy">Heredados</span>'}</td>
              <td>${ui.badge(u.activo ? 'Activo' : 'Inactivo', u.activo ? 'success' : 'danger')}</td>
              <td>${ui.date(u.created_at)}</td>
              <td class="actions-col">
                ${canEdit ? `<button class="icon-btn" data-edit-user="${ui.esc(u.id)}" title="Editar">${ui.icon('edit', 16)}</button>` : ''}
                ${canEdit ? `<button class="icon-btn" data-reset-user="${ui.esc(u.id)}" title="Cambiar clave">${ui.icon('key', 16)}</button>` : ''}
                ${canDelete && u.usuario !== 'ENVIA' ? `<button class="icon-btn danger" data-del-user="${ui.esc(u.id)}" title="Eliminar">${ui.icon('trash', 16)}</button>` : ''}
              </td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h3>Matriz de permisos por rol</h3><p>Acceso al módulo y a sus opciones específicas</p></div></div>
        <div class="table-wrap">
          <table class="data-table permission-table">
            <thead><tr><th>Módulo</th>${roles.map((r) => `<th class="center">${ui.esc(r.nombre)}</th>`).join('')}</tr></thead>
            <tbody>${Object.keys(catalog()).map((m) => `<tr><td>${ui.esc(catalog()[m].label)}</td>${roles.map((r) => {
              const ok = NS.store.can(r.nombre, m);
              return `<td class="center">${ok ? `<span class="perm-ok">${ui.icon('check', 13)}</span>` : `<span class="perm-no">${ui.icon('x', 13)}</span>`}</td>`;
            }).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="card-foot-note">${ui.icon('shield', 14)} SuperAdmin conserva acceso total y no puede degradarse. Los permisos personalizados de un usuario reemplazan los del rol asignado.</div>
      </section>
    `;

    const newUser = view.querySelector('#user-new');
    if (newUser) newUser.addEventListener('click', () => openForm());
    const newRole = view.querySelector('#role-new');
    if (newRole) newRole.addEventListener('click', () => openRoleForm());
    view.querySelectorAll('[data-edit-user]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.editUser)));
    view.querySelectorAll('[data-reset-user]').forEach((b) => b.addEventListener('click', () => resetPassword(b.dataset.resetUser)));
    view.querySelectorAll('[data-del-user]').forEach((b) => b.addEventListener('click', () => askDelete(b.dataset.delUser)));
    view.querySelectorAll('[data-edit-role]').forEach((b) => b.addEventListener('click', () => openRoleForm(b.dataset.editRole)));
    view.querySelectorAll('[data-del-role]').forEach((b) => b.addEventListener('click', () => askDeleteRole(b.dataset.delRole)));

    const userSearch = $('#user-search');
    if (userSearch) {
      let ut;
      userSearch.addEventListener('input', () => { clearTimeout(ut); ut = setTimeout(() => { filters.q = userSearch.value; render(view); }, 180); });
    }
    view.querySelectorAll('[data-user]').forEach((b) => b.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openForm(b.dataset.user);
    }));
  }

  /* --------------------------- Editor de permisos --------------------------- */
  function permissionEditorHtml(perms, opts) {
    const ui = NS.ui;
    const source = perms || {};
    return `<div class="perm-editor" ${opts && opts.scroll ? 'style="max-height:360px;overflow:auto;padding-right:3px"' : ''}>
      ${Object.keys(catalog()).map((module) => {
        const meta = catalog()[module];
        const p = source[module] || {};
        const enabled = p.ver !== false && !!source[module];
        const tabs = Array.isArray(p.tabs) ? p.tabs : [];
        const actions = Array.isArray(p.acciones) ? p.acciones : [];
        const allTabs = tabs.includes('*') || (meta.tabs || []).every((t) => tabs.includes(t.id));
        const allActions = actions.includes('*') || (meta.actions || []).every((a) => actions.includes(a));
        const all = enabled && allTabs && allActions;
        return `<div class="perm-module" data-perm-module="${module}">
          <div class="perm-module-head">
            <span class="role-ico" style="width:28px;height:28px;flex:0 0 28px;background:#EEF3FA;color:var(--navy)">${ui.icon(meta.icon || 'grid', 15)}</span>
            <strong>${ui.esc(meta.label)}</strong>
            <label class="perm-toggle"><input type="checkbox" data-perm-ver="${module}" ${enabled ? 'checked' : ''}> Acceso</label>
            <label class="perm-toggle"><input type="checkbox" data-perm-all="${module}" ${all ? 'checked' : ''}> Todo</label>
          </div>
          <div class="perm-options" ${enabled ? '' : 'hidden'}>
            ${(meta.tabs || []).length ? `<div><div class="perm-group-label">Opciones / pestañas</div><div class="perm-checks">${meta.tabs.map((t) => `<label class="perm-check"><input type="checkbox" data-perm-tab="${module}" value="${t.id}" ${tabs.includes('*') || tabs.includes(t.id) ? 'checked' : ''}> ${ui.esc(t.label)}</label>`).join('')}</div></div>` : `<div class="perm-empty">Este módulo no tiene pestañas internas; el permiso aplica a todo el módulo.</div>`}
            <div><div class="perm-group-label">Acciones</div><div class="perm-checks">${(meta.actions || []).map((a) => `<label class="perm-check ${a === 'ver' ? 'all' : ''}"><input type="checkbox" data-perm-action="${module}" value="${a}" ${actions.includes('*') || actions.includes(a) ? 'checked' : ''}> ${ui.esc(NS.store.ACTION_LABELS[a] || a)}</label>`).join('')}</div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function bindPermissionEditor(root) {
    root.addEventListener('change', (e) => {
      const target = e.target;
      const verModule = target.dataset.permVer;
      const allModule = target.dataset.permAll;
      if (verModule) {
        const box = root.querySelector(`[data-perm-module="${verModule}"]`);
        if (box) box.querySelector('.perm-options').hidden = !target.checked;
        if (target.checked) {
          // “Acceso” habilita el módulo y sus pestañas; “Todo” es el que
          // concede además todas las acciones de escritura.
          root.querySelectorAll(`[data-perm-tab="${verModule}"]`).forEach((cb) => { cb.checked = true; });
          const ver = root.querySelector(`[data-perm-action="${verModule}"][value="ver"]`);
          if (ver) ver.checked = true;
        }
        return;
      }
      if (allModule) {
        const box = root.querySelector(`[data-perm-module="${allModule}"]`);
        if (!box) return;
        box.querySelector('[data-perm-ver]').checked = target.checked;
        box.querySelector('.perm-options').hidden = !target.checked;
        box.querySelectorAll('[data-perm-tab], [data-perm-action]').forEach((cb) => { cb.checked = target.checked; });
        return;
      }
      const module = target.dataset.permTab || target.dataset.permAction;
      if (module) {
        const box = root.querySelector(`[data-perm-module="${module}"]`);
        if (!box) return;
        const all = box.querySelector('[data-perm-all]');
        if (all) {
          const checks = Array.from(box.querySelectorAll('[data-perm-tab], [data-perm-action]'));
          all.checked = checks.length > 0 && checks.every((cb) => cb.checked);
        }
      }
    });
  }

  function readPermissions(root) {
    const out = {};
    root.querySelectorAll('[data-perm-module]').forEach((box) => {
      const module = box.dataset.permModule;
      const enabled = box.querySelector('[data-perm-ver]');
      if (!enabled || !enabled.checked) return;
      const tabs = Array.from(box.querySelectorAll('[data-perm-tab]:checked')).map((cb) => cb.value);
      const acciones = Array.from(box.querySelectorAll('[data-perm-action]:checked')).map((cb) => cb.value);
      out[module] = { ver: true, tabs, acciones };
    });
    return out;
  }

  /* ------------------------------- Roles ------------------------------- */
  function openRoleForm(nombre) {
    const ui = NS.ui;
    if (!NS.app.canAction('users', 'roles')) return ui.toast('Tu rol no puede administrar roles.', 'warning');
    const role = nombre ? NS.store.role(nombre) : null;
    const isSuper = role && role.nombre === 'SuperAdmin';
    const perms = role ? role.permisos : {};
    const overlay = ui.modal({
      title: role ? 'Editar rol' : 'Nuevo rol',
      eyebrow: 'Seguridad · roles y permisos',
      subtitle: isSuper ? 'El rol SuperAdmin conserva acceso total y no puede degradarse.' : 'Define el acceso al módulo completo o solo a opciones específicas.',
      size: 'xl',
      body: `<form id="role-form" class="form-grid">
        <label class="field"><span>Nombre del rol *</span><input name="nombre" value="${ui.esc(role ? role.nombre : '')}" placeholder="Ej. Coordinador de flota" ${role ? 'disabled' : ''} required></label>
        <label class="field"><span>Icono</span><select name="icono">${ICON_OPTIONS.map((i) => `<option value="${i}" ${role && (role.icono === i || (!role.icono && ROLE_ICON[role.nombre] === i)) ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
        <label class="field field-full"><span>Descripción</span><input name="descripcion" value="${ui.esc(role ? role.descripcion : '')}" placeholder="Responsabilidad principal de este rol"></label>
        <label class="field field-full check-line"><input type="checkbox" name="admin" ${role && role.admin ? 'checked' : ''} ${isSuper ? 'disabled' : ''}> <span>Acceso administrativo total (puede gestionar usuarios, roles y configuración)</span></label>
        <div class="field-full">
          <div class="form-section-title"><span>02</span><div><strong>Permisos del rol</strong><small>Marca “Acceso” para habilitar el módulo y sus pestañas; usa “Todo” para conceder todas las acciones.</small></div></div>
          ${permissionEditorHtml(isSuper ? NS.store.defaultPermissions() : perms, { scroll: true })}
        </div>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="role-save">${ui.icon('check', 15)} Guardar rol</button>`
    });
    bindPermissionEditor(overlay);
    overlay.querySelector('[data-cancel]').addEventListener('click', () => ui.closeModal(overlay));
    overlay.querySelector('#role-save').addEventListener('click', () => {
      const form = overlay.querySelector('#role-form');
      if (!form.reportValidity()) return;
      const nombreFinal = role ? role.nombre : form.elements.nombre.value.trim();
      if (!nombreFinal) return ui.toast('El nombre del rol es obligatorio.', 'error');
      const permisos = isSuper ? NS.store.defaultPermissions() : readPermissions(overlay);
      if (!isSuper && !Object.keys(permisos).length) return ui.toast('Selecciona al menos un módulo para el rol.', 'error');
      try {
        NS.store.upsertRole({
          nombre: nombreFinal,
          descripcion: form.elements.descripcion.value,
          icono: form.elements.icono.value,
          admin: isSuper ? true : form.elements.admin.checked,
          permisos
        });
        ui.closeModal(overlay);
        ui.toast(role ? 'Rol actualizado.' : 'Rol creado con permisos personalizados.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function askDeleteRole(nombre) {
    const ui = NS.ui;
    const role = NS.store.role(nombre);
    if (!role) return;
    ui.confirm({ title: 'Eliminar rol', message: `Se eliminará el rol “${nombre}”. Solo es posible si no tiene usuarios asignados. ¿Continuar?`, confirmText: 'Eliminar', danger: true }).then((ok) => {
      if (!ok) return;
      try { NS.store.deleteRole(nombre); ui.toast('Rol eliminado.', 'success'); NS.app.refresh(true); }
      catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  /* ------------------------------ Usuarios ------------------------------ */
  function openForm(id) {
    const ui = NS.ui;
    const canEdit = id ? NS.app.canAction('users', 'editar') : NS.app.canAction('users', 'crear');
    if (!canEdit) return ui.toast('No tienes permiso para administrar usuarios.', 'warning');
    const u = id ? NS.store.db.users.find((x) => x.id === id) : null;
    const isMaster = u && u.usuario === 'ENVIA';
    const roles = NS.store.roles();
    const defaultRole = roles.find((r) => r.nombre === 'Auditor / Operaciones') || roles.find((r) => !r.admin) || roles[0];
    const roleName = u ? u.rol : (defaultRole ? defaultRole.nombre : 'SuperAdmin');
    const custom = !!(u && u.permisos);
    const basePerms = u && u.permisos ? u.permisos : NS.store.permissionsFor(roleName);
    const overlay = ui.modal({
      title: u ? 'Editar usuario' : 'Nuevo usuario del sistema',
      eyebrow: 'Seguridad · usuarios y permisos',
      size: 'xl',
      body: `<form id="user-form" class="form-grid">
        <label class="field"><span>Usuario *</span><input name="usuario" value="${ui.esc(u ? u.usuario : '')}" placeholder="nombre.usuario" ${u ? 'disabled' : ''} required><small>Sin espacios. Se almacena en mayúsculas.</small></label>
        <label class="field"><span>Nombre completo *</span><input name="nombre" value="${ui.esc(u ? u.nombre : '')}" placeholder="Nombre y apellido" required></label>
        <label class="field"><span>Correo corporativo *</span><input name="correo" type="email" value="${ui.esc(u ? u.correo : '')}" placeholder="usuario@envia.com.ve" required></label>
        <label class="field"><span>Rol *</span><select name="rol" id="user-role" ${isMaster ? 'disabled' : ''}>${roles.map((r) => `<option value="${ui.esc(r.nombre)}" ${roleName === r.nombre ? 'selected' : ''}>${ui.esc(r.nombre)}</option>`).join('')}</select></label>
        <label class="field"><span>${u ? 'Nueva clave (dejar vacío para conservar)' : 'Clave de acceso *'}</span><input name="password" type="password" autocomplete="new-password" ${u ? '' : 'required'} placeholder="Mínimo 6 caracteres"><small>La clave se guarda localmente en esta demostración. En producción usa Supabase Auth.</small></label>
        <label class="field"><span>Estado</span><select name="activo"><option value="true" ${!u || u.activo ? 'selected' : ''}>Activo</option><option value="false" ${u && !u.activo ? 'selected' : ''}>Inactivo</option></select></label>
        <label class="field field-full check-line"><input type="checkbox" name="permisos_custom" id="user-perm-toggle" ${custom ? 'checked' : ''} ${isMaster ? 'disabled' : ''}> <span>Permisos personalizados para este usuario (reemplazan los del rol)</span></label>
        <div class="field-full" id="user-perm-wrap" ${custom && !isMaster ? '' : 'hidden'}>
          <div class="form-note">${ui.icon('info', 14)} Si activas permisos personalizados, este usuario no heredará los cambios futuros del rol. Selecciona solo lo que necesita.</div>
          <div id="user-perm-editor">${permissionEditorHtml(basePerms, { scroll: true })}</div>
        </div>
        <p class="form-note field-full">${ui.icon('shield', 14)} El usuario maestro ENVIA conserva siempre SuperAdmin. Los permisos personalizados se validan en la interfaz y en la capa de datos.</p>
      </form>`,
      footer: `<button class="btn btn-ghost" data-cancel>Cancelar</button><button class="btn btn-primary" id="user-save">${ui.icon('check', 15)} Guardar usuario</button>`
    });

    const permWrap = overlay.querySelector('#user-perm-wrap');
    const permToggle = overlay.querySelector('#user-perm-toggle');
    const permEditor = overlay.querySelector('#user-perm-editor');
    bindPermissionEditor(permEditor);
    if (custom) permEditor.dataset.ready = '1';
    const togglePerms = () => { if (permWrap) permWrap.hidden = !(permToggle && permToggle.checked); };
    if (permToggle) permToggle.addEventListener('change', () => {
      if (permToggle.checked && !permEditor.dataset.ready) {
        permEditor.innerHTML = permissionEditorHtml(NS.store.permissionsFor(overlay.querySelector('#user-role').value), { scroll: true });
        bindPermissionEditor(permEditor);
        permEditor.dataset.ready = '1';
      }
      togglePerms();
    });
    const roleSelect = overlay.querySelector('#user-role');
    if (roleSelect) roleSelect.addEventListener('change', () => {
      if (permToggle && permToggle.checked) return;
      permEditor.innerHTML = permissionEditorHtml(NS.store.permissionsFor(roleSelect.value), { scroll: true });
      bindPermissionEditor(permEditor);
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
        activo: form.elements.activo.value === 'true',
        permisos: null
      };
      const pass = form.elements.password.value;
      if (pass) {
        if (pass.length < 6) return ui.toast('La clave debe tener al menos 6 caracteres.', 'error');
        data.password = pass;
      } else if (u) data.password = u.password;
      if (!u && !data.password) return ui.toast('Debes asignar una clave.', 'error');
      if (!ui.validEmail(data.correo)) return ui.toast('El correo no es válido.', 'error');
      if (permToggle && permToggle.checked && !isMaster) {
        const permisos = readPermissions(permEditor);
        if (!Object.keys(permisos).length) return ui.toast('Selecciona al menos un módulo en los permisos personalizados.', 'error');
        data.permisos = permisos;
      }
      try {
        NS.store.upsertUser({ ...data, id: u ? u.id : undefined });
        ui.closeModal(overlay);
        ui.toast(u ? 'Usuario actualizado.' : 'Usuario creado con acceso al sistema.', 'success');
        NS.app.refresh(true);
      } catch (e) { ui.toast(e.message, 'error'); }
    });
  }

  function resetPassword(id) {
    const ui = NS.ui;
    if (!NS.app.canAction('users', 'editar')) return ui.toast('No tienes permiso para cambiar claves.', 'warning');
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
      try {
        NS.store.upsertUser({ ...u, password: form.elements.password.value });
        ui.closeModal(overlay);
        ui.toast('Clave actualizada correctamente.', 'success');
      } catch (e) { ui.toast(e.message, 'error'); }
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
