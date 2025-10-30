import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudioRecorderProps {
  onTranscription: (text: string) => void;
}

export const AudioRecorder = ({ onTranscription }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use webm format with opus codec for better compatibility
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Grabando audio...');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];

        // Call transcription edge function
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { 
            audio: base64Data,
            mimeType: audioBlob.type 
          }
        });

        if (error) {
          throw error;
        }

        if (data?.text) {
          onTranscription(data.text);
          toast.success('Audio transcrito correctamente');
        } else {
          throw new Error('No se recibió texto de la transcripción');
        }
      };

      reader.onerror = () => {
        throw new Error('Error al leer el archivo de audio');
      };
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Error al transcribir el audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isRecording && !isTranscribing && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={startRecording}
          className="rounded-full"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
      
      {isRecording && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={stopRecording}
          className="rounded-full animate-pulse"
        >
          <Square className="h-4 w-4" />
        </Button>
      )}
      
      {isTranscribing && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled
          className="rounded-full"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      )}
    </div>
  );
};
