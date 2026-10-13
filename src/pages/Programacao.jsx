import ScheduleView from "../components/ScheduleView";

export default function Programacao({
  activeDay,
  setActiveDay,
  dayCards,
  volunteers,
  now,
  onEditShift,
  onCreateShift,
  onDeleteShift,
  onAllocateVolunteers,
  departmentName,
  eventType,
  dataEvento,
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
      onDeleteShift={onDeleteShift}
      onAllocateVolunteers={onAllocateVolunteers}
      departmentName={departmentName}
      eventType={eventType}
      dataEvento={dataEvento}
    />
  );
}
