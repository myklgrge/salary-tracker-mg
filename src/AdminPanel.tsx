import { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';

export default function AdminPanel() {
  type UserDoc = { id: string; username: string; status: string };
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const db = getFirestore();
        const snap = await getDocs(collection(db, 'users'));
        setUsers(
          snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              username: typeof data.username === 'string' ? data.username : '',
              status: typeof data.status === 'string' ? data.status : '',
            };
          })
        );
      } catch (e) {
        if (e instanceof Error) setError(e.message || 'Failed to load users');
        else setError('Failed to load users');
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  const handleApprove = async (uid: string) => {
    const db = getFirestore();
    await updateDoc(doc(db, 'users', uid), { status: 'approved' });
    setUsers(users => users.map(u => u.id === uid ? { ...u, status: 'approved' } : u));
  };
  const handleReject = async (uid: string) => {
    const db = getFirestore();
    await updateDoc(doc(db, 'users', uid), { status: 'rejected' });
    setUsers(users => users.map(u => u.id === uid ? { ...u, status: 'rejected' } : u));
  };

  return (
    <div className="salary-container" style={{ maxWidth: 500, margin: '32px auto' }}>
      <h2>Pending Registrations</h2>
      {loading ? <div>Loading...</div> : error ? <div style={{ color: 'red' }}>{error}</div> : (
        <table className="salary-table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.status}</td>
                <td>
                  {u.status === 'pending' && <>
                    <button style={{ marginRight: 8, background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }} onClick={() => handleApprove(u.id)}>Approve</button>
                    <button style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }} onClick={() => handleReject(u.id)}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
