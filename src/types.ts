export type EventoTipo =
  | "assembleia_circuito"
  | "assembleia_representante"
  | "congresso_regional"
  | (string & {});

export interface Evento {
  id: string;
  slug?: string | null;
  tipo: EventoTipo;
  estado?: string | null;
  cidade?: string | null;
  circuito?: string | null;
  ano?: number | null;
  data_evento?: string | null;
  criado_por?: string | null;
  created_at?: string;
}

export interface Volunteer {
  id: string;
  name: string;
  congregation?: string | null;
  phone?: string | null;
  availability?: string | string[] | null;
  active?: boolean | null;
  department_id?: string | null;
  created_at?: string;
}

export interface VolunteerForm {
  id: string | null;
  name: string;
  congregation: string;
  phone: string;
  active?: boolean;
}

export interface Shift {
  id: string;
  start: string;
  end: string;
  description?: string;
  vagas?: number | null;
  volunteerIds: string[];
  manualNames?: string[];
}

export interface ScheduleBlock {
  id: string;
  day: string;
  period: string;
  responsible?: string | null;
  accent?: string;
  shifts: Shift[];
}

export interface ShiftAssignment {
  volunteer_id: string | null;
  manual_name: string | null;
}

export interface ShiftEditorPayload {
  blockId: string;
  shiftId: string | null;
  startTime: string;
  endTime: string;
  description: string;
  vagas: number;
  selectedIds: string[];
  manualName: string;
}

export interface ShiftEditorState {
  blockId?: string | null;
  shiftId: string | null;
}

export interface AllocateModalState {
  blockId: string;
  shiftId: string;
  block: ScheduleBlock;
  shift: Shift;
}

export interface DayThemeEntry {
  key: string;
  color: string;
  soft: string;
  border: string;
}

export interface NavigationItem {
  path: string;
  label: string;
  iconClass: string;
  requiresDepartment?: boolean;
  coordinatorOnly?: boolean;
}

export interface AvailabilitySlot {
  id: string;
  label?: string;
  day?: string;
  period?: string;
}

export interface Profile {
  id: string;
  email?: string | null;
  name?: string | null;
  is_super_admin?: boolean;
}

export interface DepartmentRef {
  id: string;
  name: string;
  slug?: string;
  features?: unknown;
}

export interface DepartmentRecord extends DepartmentRef {
  department_id?: string | null;
  coordenador_id?: string | null;
  coordenador?: { name?: string | null } | null;
  ownerName?: string | null;
  ownerId?: string | null;
}

export interface DepartmentMembership {
  id: string;
  department_id?: string | null;
  evento_id?: string | null;
  user_id?: string | null;
  role?: string | null;
  department?: DepartmentRef | null;
  departments?: DepartmentRecord | null;
  profiles?: { id?: string; email?: string | null } | null;
}

export interface DepartmentOwner {
  userId: string | null;
  name: string | null;
}

export interface DeptStats {
  volunteers: number;
  shifts: number;
}

export interface OfflineSnapshot {
  schedule?: ScheduleBlock[] | null;
  volunteers?: Volunteer[] | null;
  savedAt?: string;
}

export interface Estado {
  id: number | string;
  sigla: string;
  nome: string;
}

export interface Cidade {
  id: number | string;
  nome: string;
}

export interface DepartmentMemberRow {
  id: string;
  role?: string | null;
  profiles?: { email?: string | null } | null;
}
