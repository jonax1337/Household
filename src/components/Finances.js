import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiDollarSign } from 'react-icons/fi';
import { financeService } from '../services/api';
import NoApartmentSelected from './NoApartmentSelected';

const Finances = ({ selectedApartment }) => {
  // Extrahiere apartmentId aus selectedApartment mit Fallback-Wert
  const apartmentId = selectedApartment?.id || 0;
  const [transactions, setTransactions] = useState([]);
  const [newTransaction, setNewTransaction] = useState({ description: '', amount: '', payer: '', participants: [] });
  const [roommates, setRoommates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState({});

  // Transaktionen und Mitbewohner laden
  useEffect(() => {
    const loadData = async () => {
      if (!apartmentId) return;
      
      try {
        setLoading(true);
        // Parallel-Anfragen für Transaktionen und Mitbewohner
        const [txData, roommatesData] = await Promise.all([
          financeService.getTransactions(apartmentId),
          financeService.getRoommates(apartmentId)
        ]);
        
        setTransactions(txData);
        setRoommates(roommatesData);
        calculateBalances(txData, roommatesData);
      } catch (error) {
        console.error('Fehler beim Laden der Finanzdaten:', error);
        
        // Fallback: Mock-Daten
        const mockRoommates = [
          { id: 1, name: 'Max' },
          { id: 2, name: 'Anna' },
          { id: 3, name: 'Lisa' }
        ];
        
        const mockTransactions = [
          { id: 1, description: 'Einkauf Aldi', amount: 35.50, payer: 'Max', 
            participants: ['Max', 'Anna', 'Lisa'], date: '2025-04-25' },
          { id: 2, description: 'Putzmittel', amount: 12.75, payer: 'Anna', 
            participants: ['Max', 'Anna'], date: '2025-04-26' },
          { id: 3, description: 'Pizza bestellt', amount: 24.90, payer: 'Lisa', 
            participants: ['Max', 'Lisa'], date: '2025-04-27' }
        ];
        
        setRoommates(mockRoommates);
        setTransactions(mockTransactions);
        calculateBalances(mockTransactions, mockRoommates);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [apartmentId]);

  // Kontostand für jeden Mitbewohner berechnen
  const calculateBalances = (txList, roommates) => {
    const balances = {};
    
    // Initialisieren der Salden für alle Mitbewohner
    roommates.forEach(roommate => {
      balances[roommate.name] = 0;
    });

    // Berechnen der Salden basierend auf Transaktionen
    txList.forEach(tx => {
      const perParticipant = tx.amount / tx.participants.length;
      
      // Der Zahler erhält Guthaben von allen anderen
      balances[tx.payer] += tx.amount;
      
      // Jeder Teilnehmer schuldet seinen Anteil
      tx.participants.forEach(participant => {
        balances[participant] -= perParticipant;
      });
    });

    setBalances(balances);
  };

  // Neue Transaktion hinzufügen
  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount || !newTransaction.payer || newTransaction.participants.length === 0) {
      alert('Bitte fülle alle Felder aus');
      return;
    }

    try {
      const txData = {
        ...newTransaction,
        amount: parseFloat(newTransaction.amount),
        date: new Date().toISOString().split('T')[0]
      };
      
      const addedTx = await financeService.addTransaction(apartmentId, txData);
      const updatedTransactions = [...transactions, addedTx];
      setTransactions(updatedTransactions);
      calculateBalances(updatedTransactions, roommates);
      
      // Formular zurücksetzen
      setNewTransaction({ description: '', amount: '', payer: '', participants: [] });
    } catch (error) {
      console.error('Fehler beim Hinzufügen der Transaktion:', error);
      
      // Fallback: Mock-Transaktion hinzufügen
      const mockTx = {
        id: Date.now(),
        ...newTransaction,
        amount: parseFloat(newTransaction.amount),
        date: new Date().toISOString().split('T')[0]
      };
      
      const updatedTransactions = [...transactions, mockTx];
      setTransactions(updatedTransactions);
      calculateBalances(updatedTransactions, roommates);
      setNewTransaction({ description: '', amount: '', payer: '', participants: [] });
    }
  };

  // Transaktion löschen
  const deleteTransaction = async (txId) => {
    try {
      await financeService.deleteTransaction(apartmentId, txId);
      const updatedTransactions = transactions.filter(tx => tx.id !== txId);
      setTransactions(updatedTransactions);
      calculateBalances(updatedTransactions, roommates);
    } catch (error) {
      console.error('Fehler beim Löschen der Transaktion:', error);
      
      // Fallback: Lokales Löschen
      const updatedTransactions = transactions.filter(tx => tx.id !== txId);
      setTransactions(updatedTransactions);
      calculateBalances(updatedTransactions, roommates);
    }
  };

  // Handler für die Teilnehmerauswahl (Checkboxen)
  const handleParticipantChange = (roommateName) => {
    const participants = [...newTransaction.participants];
    
    if (participants.includes(roommateName)) {
      // Entfernen wenn bereits ausgewählt
      const index = participants.indexOf(roommateName);
      participants.splice(index, 1);
    } else {
      // Hinzufügen wenn noch nicht ausgewählt
      participants.push(roommateName);
    }
    
    setNewTransaction({...newTransaction, participants});
  };

  // Funktion zum Formatieren von Geldbeträgen
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

    // Wenn keine Wohnung ausgewählt ist, zeige die NoApartmentSelected-Komponente
    if (!selectedApartment || !selectedApartment.id) {
      return <NoApartmentSelected component="finances" />;
    }

  if (loading) {
    return <div className="centered-content">Lade Finanzdaten...</div>;
  }

  return (
    <div className="container fadeIn">
      <div className="card" style={{ marginBottom: '20px' }}>
        <h1 style={{ marginBottom: '20px' }}>Finanzen</h1>
        
        {/* Kontenübersicht */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>Kontostand</h3>
          <div className="balances-grid">
            {Object.entries(balances).map(([name, balance]) => (
              <div key={name} className={`balance-card ${balance >= 0 ? 'positive' : 'negative'}`}>
                <div className="balance-name">{name}</div>
                <div className="balance-amount">{formatCurrency(balance)}</div>
                <div className="balance-status">
                  {balance > 0 ? 'bekommt Geld' : balance < 0 ? 'schuldet Geld' : 'ausgeglichen'}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Neue Transaktion */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>Neue Ausgabe</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div>
              <label htmlFor="txDescription">Beschreibung</label>
              <input
                id="txDescription"
                type="text"
                className="input"
                placeholder="z.B. Einkauf Aldi"
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
              />
            </div>
            <div>
              <label htmlFor="txAmount">Betrag (€)</label>
              <input
                id="txAmount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                placeholder="z.B. 24.99"
                value={newTransaction.amount}
                onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '15px' }}>
            <label htmlFor="txPayer">Bezahlt von</label>
            <select
              id="txPayer"
              className="input"
              value={newTransaction.payer}
              onChange={(e) => setNewTransaction({...newTransaction, payer: e.target.value})}
            >
              <option value="">Bitte auswählen</option>
              {roommates.map(roommate => (
                <option key={roommate.id} value={roommate.name}>{roommate.name}</option>
              ))}
            </select>
          </div>
          
          <div style={{ marginTop: '15px' }}>
            <label>Beteiligt</label>
            <div className="participants-checkboxes">
              {roommates.map(roommate => (
                <div key={roommate.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`participant-${roommate.id}`}
                    checked={newTransaction.participants.includes(roommate.name)}
                    onChange={() => handleParticipantChange(roommate.name)}
                  />
                  <label htmlFor={`participant-${roommate.id}`}>{roommate.name}</label>
                </div>
              ))}
            </div>
          </div>
          
          <button 
            className="button primary" 
            onClick={handleAddTransaction}
            style={{ marginTop: '15px' }}
          >
            <FiPlus size={18} style={{ marginRight: '8px' }} />
            Ausgabe hinzufügen
          </button>
        </div>
        
        {/* Transaktionsliste */}
        <div>
          <h3 style={{ marginBottom: '15px' }}>Letzte Transaktionen</h3>
          
          {transactions.length === 0 ? (
            <div className="empty-state">
              <FiDollarSign size={40} style={{ opacity: 0.5, marginBottom: '10px' }} />
              <p>Keine Transaktionen vorhanden</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Füge deine erste Ausgabe hinzu</p>
            </div>
          ) : (
            <div className="transactions-list">
              {transactions.map(tx => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-info">
                    <div className="transaction-primary">
                      <div className="transaction-description">{tx.description}</div>
                      <div className="transaction-amount">{formatCurrency(tx.amount)}</div>
                    </div>
                    <div className="transaction-secondary">
                      <div className="transaction-date">{new Date(tx.date).toLocaleDateString()}</div>
                      <div className="transaction-payer">Bezahlt von: {tx.payer}</div>
                    </div>
                    <div className="transaction-participants">
                      Beteiligt: {tx.participants.join(', ')}
                    </div>
                  </div>
                  <button className="transaction-delete" onClick={() => deleteTransaction(tx.id)}>
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Zusätzlicher Div am Ende des Containers für Abstand zur Navbar */}
      <div style={{ marginBottom: '120px' }}></div>
    </div>
  );
};

export default Finances;
