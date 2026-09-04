import ScheduleView from "../components/ScheduleView";

export default function Programacao({
  activeDay,
  setActiveDay,
  dayCards,
  volunteers,
  now,
  onEditShift,
  onCreateShift,
  departmentName,
}) {
  return (
    <ScheduleView
      activeDay={activeDay}
      setActiveDay={setActiveDay}
      dayCards={dayCards}
      volunteers={volunteers}
      now={now}
      onEditShift={onEditShift}
      onCreateShift={onCreateShift}
      departmentName={departmentName}
    />
  );
}
