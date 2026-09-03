import ScheduleView from "../components/ScheduleView";

export default function Programacao({ activeDay, setActiveDay, dayCards, volunteers, now, onEditShift }) {
  return (
    <ScheduleView
      activeDay={activeDay}
      setActiveDay={setActiveDay}
      dayCards={dayCards}
      volunteers={volunteers}
      now={now}
      onEditShift={onEditShift}
    />
  );
}
