import VolunteersView from "../components/VolunteersView";
import { emptyVolunteer } from "../utils/helpers";

export default function Voluntarios({
  volunteers,
  volunteerForm,
  setVolunteerForm,
  onSave,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  departmentName,
}) {
  return (
    <VolunteersView
      volunteers={volunteers}
      volunteerForm={volunteerForm}
      setVolunteerForm={setVolunteerForm}
      onSave={onSave}
      onEdit={onEdit}
      onDelete={onDelete}
      onCancel={() => setVolunteerForm(emptyVolunteer())}
      onApprove={onApprove}
      onReject={onReject}
      departmentName={departmentName}
    />
  );
}
