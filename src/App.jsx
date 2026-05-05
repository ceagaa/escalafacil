import { useState, useEffect, useMemo } from "react";
import {
  initialSchedule,
  initialVolunteers,
  initialItems,
  emptyVolunteer,
  emptyItem,
  sanitizeSchedule,
  fetchSupabaseData,
  supabaseRequest,
  mapAppVolunteerToDb,
  mapAppItemToDb,
  mapDbItemToApp,
  makeId,
  formatCurrentDate,
  registerServiceWorker,
  buildOfflineSnapshot,
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  navigationItems,
} from "./utils/helpers";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { Stat, Button, Modal } from "./components/UI";
import ScheduleView from "./components/ScheduleView";
import VolunteersView from "./components/VolunteersView";
import ChecklistView from "./components/ChecklistView";
import ShiftEditorModal from "./components/ShiftEditorModal";

export default function App() {
  const [activeDay, setActiveDay] = useState("Sexta-feira");
  const [activeView, setActiveView] = useState("Programação");
  const [query, setQuery] = useState("");
  const [schedule, setSchedule] = useLocalStorage("ap_schedule_v4_validation", initialSchedule, sanitizeSchedule);
  const [volunteers, setVolunteers] = useLocalStorage("ap_volunteers", initialVolunteers);
  const [items, setItems] = useLocalStorage("ap_items", initialItems);
  const [passwordModal, setPasswordModal] = useState(null);
  const [shiftEditor, setShiftEditor] = useState(null);
  const [volunteerForm, setVolunteerForm] = useState(emptyVolunteer());
  const [itemForm, setItemForm] = useState(emptyItem());
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    async function loadRemoteData() {
      if (!isOnline || hasLoadedRemoteData) return;
      try {
        const data = await fetchSupabaseData();
        setSchedule(data.schedule);
        setVolunteers(data.volunteers);
        setItems(data.items);
        setHasLoadedRemoteData(true);
        showToast("Dados sincronizados com Supabase.");
      } catch (error) {
        console.warn("Falha ao buscar dados no Supabase.", error);
        showToast("Falha Supabase: " + (error?.message || "verifique tabelas/RLS"));
        const backup = loadOfflineSnapshot();
        if (backup) {
          setSchedule(backup.schedule || initialSchedule);
          setVolunteers(backup.volunteers || initialVolunteers);
          setItems(backup.items || initialItems);
        }
      }
    }
    loadRemoteData();
  }, [isOnline, hasLoadedRemoteData, setSchedule, setVolunteers, setItems]);

  useEffect(() => {
    const snapshot = buildOfflineSnapshot(schedule, volunteers, items);
    saveOfflineSnapshot(snapshot);
  }, [schedule, volunteers, items]);

  const isVolunteerEditorUnlocked = passwordModal?.unlocked === true;
  const dayCards = useMemo(() => schedule.filter((item) => item.day === activeDay), [schedule, activeDay]);
  const totalShifts = useMemo(() => schedule.reduce((acc, item) => acc + item.shifts.length, 0), [schedule]);
  const assignedShifts = useMemo(
    () => schedule.flatMap((block) => block.shifts).filter((shift) => shift.volunteerIds.length > 0).length,
    [schedule]
  );
  const pendingItems = useMemo(() => items.filter((item) => item.status !== "Entregue").length, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      (item.person + " " + item.item + " " + item.day + " " + item.status)
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [items, query]);

  function openProtectedAction(action, payload = null) {
    setPasswordError("");
    setPasswordModal({ action, payload, password: "", unlocked: false });
  }

  function confirmPassword() {
    if (!passwordModal || passwordModal.password !== "1cor14:40") {
      setPasswordError("Senha incorreta. Tente novamente.");
      return;
    }
    const { action, payload } = passwordModal;
    setPasswordError("");

    if (action === "edit-shift") {
      setShiftEditor(payload);
      setPasswordModal(null);
      return;
    }

    if (action === "edit-volunteers") {
      setPasswordModal({ ...passwordModal, unlocked: true });
    }
  }

  async function saveShiftVolunteers(selectedIds) {
    if (!shiftEditor) return;
    const targetShiftId = shiftEditor.shiftId;
    const nextSchedule = schedule.map((block) => ({
      ...block,
      shifts: block.shifts.map((shift) =>
        shift.id === targetShiftId ? { ...shift, volunteerIds: selectedIds } : shift
      ),
    }));

    setSchedule(nextSchedule);
    setShiftEditor(null);
    showToast("Voluntários atualizados no turno.");

    if (!isOnline) return;

    try {
      await supabaseRequest(
        "/shift_volunteers?shift_id=eq." + encodeURIComponent(targetShiftId),
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );

      if (selectedIds.length) {
        await supabaseRequest("/shift_volunteers", {
          method: "POST",
          body: JSON.stringify(selectedIds.map((volunteerId) => ({ shift_id: targetShiftId, volunteer_id: volunteerId }))),
          headers: { Prefer: "return=minimal" },
        });
      }
    } catch (error) {
      console.warn("Falha ao salvar escala no Supabase.", error);
      showToast("Escala salva offline. Sincronize quando voltar a internet.");
    }
  }

  async function saveVolunteer(event) {
    event.preventDefault();
    const name = volunteerForm.name.trim();
    if (!name) return;

    const payload = {
      ...volunteerForm,
      name,
      congregation: volunteerForm.congregation.trim(),
      phone: volunteerForm.phone.trim(),
    };

    if (!isOnline) {
      if (payload.id) {
        setVolunteers((current) => current.map((volunteer) => (volunteer.id === payload.id ? payload : volunteer)));
        showToast("Voluntário atualizado offline.");
      } else {
        setVolunteers((current) => [{ ...payload, id: makeId("local-v"), active: true }, ...current]);
        showToast("Voluntário cadastrado offline.");
      }
      setVolunteerForm(emptyVolunteer());
      return;
    }

    try {
      if (payload.id && !String(payload.id).startsWith("local-")) {
        const [updated] = await supabaseRequest(
          "/volunteers?id=eq." + encodeURIComponent(payload.id),
          { method: "PATCH", body: JSON.stringify(mapAppVolunteerToDb(payload)), preferRepresentation: true }
        );
        setVolunteers((current) => current.map((volunteer) => (volunteer.id === payload.id ? updated : volunteer)));
        showToast("Voluntário atualizado.");
      } else {
        const [created] = await supabaseRequest("/volunteers", {
          method: "POST",
          body: JSON.stringify(mapAppVolunteerToDb(payload)),
          preferRepresentation: true,
        });
        setVolunteers((current) => [created, ...current]);
        showToast("Voluntário cadastrado.");
      }
      setVolunteerForm(emptyVolunteer());
    } catch (error) {
      console.warn("Falha ao salvar voluntário no Supabase.", error);
      showToast("Não foi possível salvar no Supabase.");
    }
  }

  async function removeVolunteer(id) {
    setVolunteers((current) => current.filter((volunteer) => volunteer.id !== id));
    setSchedule((current) =>
      current.map((block) => ({
        ...block,
        shifts: block.shifts.map((shift) => ({
          ...shift,
          volunteerIds: shift.volunteerIds.filter((volunteerId) => volunteerId !== id),
        })),
      }))
    );
    showToast("Voluntário removido da lista e da escala.");

    if (!isOnline || String(id).startsWith("local-")) return;

    try {
      await supabaseRequest("/volunteers?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    } catch (error) {
      console.warn("Falha ao excluir voluntário no Supabase.", error);
    }
  }

  async function saveItem(event) {
    event.preventDefault();
    const itemName = itemForm.item.trim();
    if (!itemName) return;

    const payload = {
      id: itemForm.id,
      person: itemForm.person.trim(),
      item: itemName,
      day: itemForm.day,
      status: itemForm.status,
      photo: itemForm.photo || "",
    };

    if (!isOnline) {
      if (payload.id) {
        setItems((current) => current.map((item) => (item.id === payload.id ? payload : item)));
        showToast("Item atualizado offline.");
      } else {
        setItems((current) => [{ ...payload, id: makeId("local-i") }, ...current]);
        showToast("Item cadastrado offline.");
      }
      setItemForm(emptyItem());
      return;
    }

    try {
      if (payload.id && !String(payload.id).startsWith("local-")) {
        const [updated] = await supabaseRequest(
          "/lost_items?id=eq." + encodeURIComponent(payload.id),
          { method: "PATCH", body: JSON.stringify(mapAppItemToDb(payload)), preferRepresentation: true }
        );
        setItems((current) => current.map((item) => (item.id === payload.id ? mapDbItemToApp(updated) : item)));
        showToast("Item atualizado.");
      } else {
        const [created] = await supabaseRequest("/lost_items", {
          method: "POST",
          body: JSON.stringify(mapAppItemToDb(payload)),
          preferRepresentation: true,
        });
        setItems((current) => [mapDbItemToApp(created), ...current]);
        showToast("Item cadastrado.");
      }
      setItemForm(emptyItem());
    } catch (error) {
      console.warn("Falha ao salvar item no Supabase.", error);
      showToast("Não foi possível salvar no Supabase.");
    }
  }

  async function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
    showToast("Item removido do checklist.");

    if (!isOnline || String(id).startsWith("local-")) return;

    try {
      await supabaseRequest("/lost_items?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
    } catch (error) {
      console.warn("Falha ao excluir item no Supabase.", error);
    }
  }

  async function updateItemStatus(id, status) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));

    if (!isOnline || String(id).startsWith("local-")) return;

    try {
      await supabaseRequest("/lost_items?id=eq." + encodeURIComponent(id), {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: { Prefer: "return=minimal" },
      });
    } catch (error) {
      console.warn("Falha ao atualizar status no Supabase.", error);
    }
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <div className="ap-app min-h-screen bg-[#f6f6f6] text-slate-900">
      {toast && (
        <div className="app-toast fixed left-1/2 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-[#172233] bg-[#172233] p-5 backdrop-blur-xl lg:block">
        <div>
          <p className="text-sm text-slate-400">Departamento</p>
          <h1 className="font-semibold leading-tight text-[#42d27b]">Achados Perdidos & Guarda Volumes</h1>
        </div>

        <div className="mt-10 flex items-center gap-4 px-2">
          <span className="text-base font-semibold text-[#d8ff56]">Menu</span>
          <span className="h-px flex-1 border-t border-dashed border-[#d8ff56]/35" />
        </div>

        <nav className="mt-5 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.value}
              onClick={() => setActiveView(item.value)}
              className={`app-nav-button flex w-full items-center gap-3 text-sm transition ${
                activeView === item.value ? "is-active" : ""
              }`}
            >
              <i className={item.iconClass} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <div className="mobile-department-brand px-4 pb-2 pt-5">
          <p className="text-sm text-slate-400">Departamento</p>
          <h1 className="font-semibold leading-tight text-[#42d27b]">Achados Perdidos & Guarda Volumes</h1>
        </div>

        <header className="ap-header">
          <div className="w-full bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
            <h1 className="text-xl font-bold tracking-tight text-[#172233] md:text-3xl">Dashboard</h1>
          </div>
        </header>

        <section className="ap-main-content space-y-6 p-4 md:p-8">
          <p className="text-sm font-medium capitalize text-slate-500 md:text-base">
            {formatCurrentDate(now)}
          </p>

          <div className="ap-stats-scroll -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            <div className="ap-stats-row flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-3 md:gap-4">
              <Stat
                icon="clock"
                label="Turnos"
                value={totalShifts}
                detail={assignedShifts + "/" + totalShifts + " designado"}
                day={activeDay}
              />
              <Stat
                icon="users"
                label="Voluntários"
                value={volunteers.length}
                detail="cadastros ativos"
                day={activeDay}
              />
              <Stat
                icon="checklist"
                label="Checklist"
                value={pendingItems}
                detail="itens perdidos"
                day={activeDay}
              />
            </div>
          </div>

          {activeView === "Programação" && (
            <ScheduleView
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              dayCards={dayCards}
              volunteers={volunteers}
              now={now}
              onEditShift={(payload) => openProtectedAction("edit-shift", payload)}
            />
          )}

          {activeView === "Voluntários" && (
            <VolunteersView
              volunteers={volunteers}
              volunteerForm={volunteerForm}
              setVolunteerForm={setVolunteerForm}
              isUnlocked={isVolunteerEditorUnlocked}
              onUnlock={() => openProtectedAction("edit-volunteers")}
              onSave={saveVolunteer}
              onEdit={setVolunteerForm}
              onDelete={removeVolunteer}
              onCancel={() => setVolunteerForm(emptyVolunteer())}
            />
          )}

          {activeView === "Checklist" && (
            <ChecklistView
              query={query}
              setQuery={setQuery}
              items={filteredItems}
              itemForm={itemForm}
              setItemForm={setItemForm}
              onSave={saveItem}
              onEdit={setItemForm}
              onDelete={removeItem}
              onStatusChange={updateItemStatus}
              onCancel={() => setItemForm(emptyItem())}
            />
          )}
        </section>
      </main>

      <div className="ap-mobile-nav lg:hidden">
        {navigationItems.map((item) => (
          <button
            key={item.value}
            onClick={() => setActiveView(item.value)}
            className={`app-mobile-nav-button ${activeView === item.value ? "is-active" : ""}`}
          >
            <i className={item.iconClass} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {passwordModal && !passwordModal.unlocked && (
        <Modal title="Senha para editar" onClose={() => setPasswordModal(null)}>
          <p className="text-sm text-slate-500">Digite a senha para liberar esta edição.</p>
          <input
            type="password"
            value={passwordModal.password}
            onChange={(event) => setPasswordModal({ ...passwordModal, password: event.target.value })}
            onKeyDown={(event) => event.key === "Enter" && confirmPassword()}
            placeholder="Senha"
            className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            autoFocus
          />
          {passwordError && <p className="mt-2 text-sm font-medium text-rose-600">{passwordError}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPasswordModal(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmPassword}>Liberar</Button>
          </div>
        </Modal>
      )}

      {shiftEditor && (
        <ShiftEditorModal
          shiftEditor={shiftEditor}
          volunteers={volunteers}
          schedule={schedule}
          onClose={() => setShiftEditor(null)}
          onSave={saveShiftVolunteers}
        />
      )}
    </div>
  );
}
