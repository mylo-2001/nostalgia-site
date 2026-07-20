export function Stub({ title }: { title: string }) {
  return (
    <div>
      <h2 className="main__title">{title}</h2>
      <p className="muted" style={{ maxWidth: 520, lineHeight: 1.6 }}>
        Αυτή η ενότητα δεν έχει μεταφερθεί ακόμη στο νέο React admin.
        Θα μεταφερθεί σε επόμενη φάση (με τον ίδιο προσεκτικό τρόπο όπως οι Παραγγελίες).
      </p>
    </div>
  );
}
