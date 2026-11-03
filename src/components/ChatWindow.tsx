import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Message } from '../types';
import { useApp } from '../store';
import { Send, User, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

interface ChatWindowProps {
  orderId: string;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ orderId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { user } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'orders', orderId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as Message));
      setMessages(fetched);
    }, (error) => {
      console.error("ChatWindow onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), {
        text: newMessage,
        senderId: auth.currentUser?.uid,
        senderName: user.name,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      className="fixed inset-x-0 bottom-0 top-20 bg-[#121214] text-white z-50 flex flex-col rounded-t-[2.5rem] shadow-2xl overflow-hidden border-t border-zinc-800"
    >
      <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FECC01]/10 border border-[#FECC01]/30 rounded-xl flex items-center justify-center text-[#FECC01]">
            <User size={20} />
          </div>
          <div>
            <h3 className="font-black italic text-white text-base">Chat de Entrega</h3>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Pedido #{orderId.slice(-6).toUpperCase()}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full flex items-center justify-center shadow-sm border border-zinc-700 active:scale-95">
          <X size={20} />
        </button>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="space-y-4">
          {messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl shadow-md ${
                  isMe ? 'bg-[#FECC01] text-black font-semibold rounded-tr-none' : 'bg-zinc-800 text-white border border-zinc-700 rounded-tl-none'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                </div>
                <p className="text-[10px] text-zinc-400 mt-1 font-bold">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="p-6 bg-[#121214] border-t border-zinc-800 pb-10">
        <form onSubmit={handleSend} className="flex gap-2 relative">
          <Input 
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 h-12 rounded-2xl bg-zinc-900 border-zinc-750 text-white placeholder-zinc-400 pr-12 focus:bg-zinc-900 focus-visible:ring-[#FECC01] transition-all shadow-sm"
          />
          <Button type="submit" size="icon" className="absolute right-1 top-1 bottom-1 w-10 h-10 rounded-xl bg-[#FECC01] hover:bg-[#ebd534] text-black">
            <Send size={18} />
          </Button>
        </form>
      </div>
    </motion.div>
  );
};
