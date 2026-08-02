import * as Y from "yjs";
import * as awarenessProtocol from 'y-protocols/awareness';
import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";

export class SupabaseProvider {
  doc: Y.Doc;
  awareness: any;
  channel: RealtimeChannel;
  private listeners: Record<string, Function[]> = {};
  
  constructor(doc: Y.Doc, supabase: SupabaseClient, config: { channel: string }) {
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);
    
    // Create a Supabase Realtime channel
    this.channel = supabase.channel(config.channel, {
      config: {
        broadcast: { ack: false },
      },
    });
    
    // Handle incoming Yjs document updates
    this.channel.on('broadcast', { event: 'update' }, ({ payload }) => {
      if (payload && payload.update) {
        try {
          Y.applyUpdate(this.doc, new Uint8Array(payload.update), 'remote');
        } catch (e) {
          console.error("Yjs applyUpdate error", e);
        }
      }
    });

    // Handle incoming Awareness (cursor) updates
    this.channel.on('broadcast', { event: 'awareness' }, ({ payload }) => {
      if (payload && payload.update) {
        try {
          awarenessProtocol.applyAwarenessUpdate(this.awareness, new Uint8Array(payload.update), 'remote');
        } catch (e) {
          console.error("Awareness applyUpdate error", e);
        }
      }
    });

    // Handle Sync Protocol: Step 1 (Incoming Request for Missing Data)
    this.channel.on('broadcast', { event: 'sync-step-1' }, ({ payload }) => {
      if (payload && payload.stateVector) {
        try {
          const stateVector = new Uint8Array(payload.stateVector);
          const update = Y.encodeStateAsUpdate(this.doc, stateVector);
          this.channel.send({
            type: 'broadcast',
            event: 'sync-step-2',
            payload: { update: Array.from(update) }
          }).catch(() => {});
        } catch (e) {
          console.error("Yjs sync-step-1 error", e);
        }
      }
    });

    // Handle Sync Protocol: Step 2 (Incoming Missing Data)
    this.channel.on('broadcast', { event: 'sync-step-2' }, ({ payload }) => {
      if (payload && payload.update) {
        try {
          Y.applyUpdate(this.doc, new Uint8Array(payload.update), 'remote');
        } catch (e) {
          console.error("Yjs sync-step-2 error", e);
        }
      }
    });

    // Subscribe to the channel
    this.channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        this.emit('status', [{ status: 'connected' }]);
        
        // Initiate Sync Protocol
        const stateVector = Y.encodeStateVector(this.doc);
        this.channel.send({
          type: 'broadcast',
          event: 'sync-step-1',
          payload: { stateVector: Array.from(stateVector) }
        }).catch(() => {});
        
        // Broadcast our current awareness
        const localAwareness = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.awareness.clientID]);
        this.channel.send({
          type: 'broadcast',
          event: 'awareness',
          payload: { update: Array.from(localAwareness) }
        }).catch(() => {});
        
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.emit('status', [{ status: 'disconnected', error: err }]);
      }
    });

    // Broadcast local Yjs document updates to others
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') {
        this.channel.send({
          type: 'broadcast',
          event: 'update',
          payload: { update: Array.from(update) }
        }).catch(() => {});
      }
    });

    // Broadcast local Awareness updates to others
    this.awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin !== 'remote') {
        const changedClients = added.concat(updated).concat(removed);
        const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
        this.channel.send({
          type: 'broadcast',
          event: 'awareness',
          payload: { update: Array.from(update) }
        }).catch(() => {});
      }
    });
  }
  
  on(event: string, callback: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }
  
  off(event: string, callback: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  private emit(event: string, args: any[]) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(cb => cb(...args));
  }
  
  destroy() {
    this.channel.unsubscribe();
    this.awareness.destroy();
  }
}
