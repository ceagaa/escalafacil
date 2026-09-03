import ChecklistView from "../components/ChecklistView";
import { emptyItem } from "../utils/helpers";

export default function ItensPerdidos({
  query,
  setQuery,
  items,
  itemForm,
  setItemForm,
  onSave,
  onEdit,
  onDelete,
  onStatusChange,
}) {
  return (
    <ChecklistView
      query={query}
      setQuery={setQuery}
      items={items}
      itemForm={itemForm}
      setItemForm={setItemForm}
      onSave={onSave}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={onStatusChange}
      onCancel={() => setItemForm(emptyItem())}
    />
  );
}
