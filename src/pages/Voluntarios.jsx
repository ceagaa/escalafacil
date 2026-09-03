import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import VolunteersView from "../components/VolunteersView";
import LoginModal from "../components/LoginModal";
import { emptyVolunteer } from "../utils/helpers";

export default function Voluntarios({
  volunteers,
  volunteerForm,
  setVolunteerForm,
  onSave,
  onEdit,
  onDelete,
}) {
  const { user, login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  async function handleLogin(email, password) {
    await login(email, password);
    setShowLogin(false);
  }

  return (
    <>
      <VolunteersView
        volunteers={volunteers}
        volunteerForm={volunteerForm}
        setVolunteerForm={setVolunteerForm}
        isUnlocked={!!user}
        onUnlock={() => setShowLogin(true)}
        onSave={onSave}
        onEdit={onEdit}
        onDelete={onDelete}
        onCancel={() => setVolunteerForm(emptyVolunteer())}
      />
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
