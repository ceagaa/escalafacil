import VolunteersView, { type VolunteersViewProps } from "../components/VolunteersView";
import { emptyVolunteer } from "../utils/helpers";

export default function Voluntarios({ ...props }: Omit<VolunteersViewProps, "onCancel">) {
  return (
    <VolunteersView
      {...props}
      onCancel={() => props.setVolunteerForm(emptyVolunteer())}
    />
  );
}
