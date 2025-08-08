import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface ChatwootContact {
    identifier?: string;
    name?: string;
    phone_number?: string;
    avatar_url?: string;
}

interface ChatwootMessage {
    content: string;
    message_type: 'incoming' | 'outgoing';
    private?: boolean;
    content_type?: 'text' | 'input_email' | 'cards' | 'input_select' | 'form' | 'article';
}

class ChatwootService {
    private baseURL: string;
    private apiToken: string;
    private inboxIdentifier: string;
    private accountId: string;

    constructor() {
        this.baseURL = process.env.CHATWOOT_URL || '';
        this.apiToken = process.env.CHATWOOT_API_ACCESS_TOKEN || '';
        this.inboxIdentifier = process.env.CHATWOOT_INBOX_IDENTIFIER || '';
        this.accountId = '130781'; // Tu account ID actual
        
        if (!this.baseURL || !this.apiToken || !this.inboxIdentifier) {
            console.error('❌ Variables de Chatwoot no configuradas correctamente');
        }
    }

    /**
     * Formatear número de teléfono al formato E164
     */
    private formatPhoneToE164(phoneNumber: string): string {
        // Limpiar el número de espacios y caracteres especiales
        let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Si ya tiene +, devolverlo tal como está
        if (cleanNumber.startsWith('+')) {
            return cleanNumber;
        }
        
        // Si el número comienza con 521 (México con código de celular)
        if (cleanNumber.startsWith('521')) {
            return `+${cleanNumber}`;
        }
        
        // Si el número comienza con 52 (México)
        if (cleanNumber.startsWith('52')) {
            return `+${cleanNumber}`;
        }
        
        // Si es un número de 10 dígitos (probablemente México sin código de país)
        if (cleanNumber.length === 10) {
            return `+521${cleanNumber}`;
        }
        
        // Si es un número de 12 dígitos que comienza con 52
        if (cleanNumber.length === 12 && cleanNumber.startsWith('52')) {
            return `+${cleanNumber}`;
        }
        
        // Por defecto, agregar + si no lo tiene
        return `+${cleanNumber}`;
    }

    private getHeaders() {
        return {
            'api_access_token': this.apiToken,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Obtener información de la cuenta para verificar conexión
     */
    async getAccountInfo(): Promise<any> {
        try {
            console.log(`🔍 Obteniendo info de cuenta desde: ${this.baseURL}/api/v1/profile`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/profile`,
                { headers: this.getHeaders() }
            );
            
            console.log(`📋 Perfil obtenido exitosamente`);
            
            // Obtener el account_id desde la respuesta
            if (response.data && response.data.accounts && response.data.accounts.length > 0) {
                this.accountId = response.data.accounts[0].id.toString();
                console.log(`✅ Account ID obtenido: ${this.accountId}`);
            }
            
            return response.data;
        } catch (error: any) {
            console.error('❌ Error obteniendo info de cuenta:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Crear o actualizar un contacto en Chatwoot
     */
    async createOrUpdateContact(phoneNumber: string, name?: string): Promise<any> {
        try {
            // Formatear número al formato E164
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Creando contacto - Original: ${phoneNumber}, Formateado: ${formattedPhone}`);
            
            const contactData: ChatwootContact = {
                identifier: formattedPhone,
                name: name || phoneNumber,
                phone_number: formattedPhone
            };

            console.log(`📤 Datos del contacto:`, JSON.stringify(contactData, null, 2));

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts`,
                contactData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Contacto creado exitosamente para ${formattedPhone}`);
            return response.data;
        } catch (error: any) {
            console.error(`❌ Error creando contacto:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            if (error.response?.status === 422) {
                console.log(`🔍 Contacto ya existe, buscando...`);
                const formattedPhone = this.formatPhoneToE164(phoneNumber);
                return await this.findContactByPhone(formattedPhone);
            }
            throw error;
        }
    }

    /**
     * Buscar contacto por número de teléfono
     */
    async findContactByPhone(phoneNumber: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Buscando contacto para: ${formattedPhone}`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts/search?q=${encodeURIComponent(formattedPhone)}`,
                { headers: this.getHeaders() }
            );

            const contacts = response.data.payload;
            if (contacts && contacts.length > 0) {
                console.log(`✅ Contacto encontrado: ${contacts[0].id}`);
                return contacts[0];
            }
            
            console.log(`❌ No se encontró contacto para: ${formattedPhone}`);
            return null;
        } catch (error: any) {
            console.error('❌ Error buscando contacto:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Crear una conversación en Chatwoot
     */
    async createConversation(contactId: number, phoneNumber: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Creando conversación para contacto ID: ${contactId}, teléfono: ${formattedPhone}`);
            
            const conversationData = {
                source_id: formattedPhone,
                inbox_id: parseInt(this.inboxIdentifier), // Convertir a número
                contact_id: contactId
            };

            console.log(`📤 Datos de conversación:`, JSON.stringify(conversationData, null, 2));

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations`,
                conversationData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Conversación creada exitosamente: ${response.data.id}`);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error creando conversación:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            throw error;
        }
    }

    /**
     * Enviar mensaje entrante a Chatwoot
     */
    async sendIncomingMessage(conversationId: number, message: string): Promise<any> {
        try {
            const messageData: ChatwootMessage = {
                content: message,
                message_type: 'incoming'
            };

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations/${conversationId}/messages`,
                messageData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Mensaje entrante enviado a Chatwoot (Conversación: ${conversationId})`);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error enviando mensaje entrante:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Enviar mensaje saliente desde Chatwoot
     */
    async sendOutgoingMessage(conversationId: number, message: string): Promise<any> {
        try {
            const messageData: ChatwootMessage = {
                content: message,
                message_type: 'outgoing'
            };

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations/${conversationId}/messages`,
                messageData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Mensaje saliente enviado desde Chatwoot`);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error enviando mensaje saliente:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Buscar conversación existente por número de teléfono
     */
    async findConversationByPhone(phoneNumber: string): Promise<any> {
        try {
            const formattedPhone = this.formatPhoneToE164(phoneNumber);
            console.log(`🔍 Buscando conversación para: ${formattedPhone}`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations?status=open&inbox_id=${this.inboxIdentifier}`,
                { headers: this.getHeaders() }
            );

            const conversations = response.data.data?.payload || [];
            const conversation = conversations.find((conv: any) => {
                const contactPhone = conv.meta?.sender?.phone_number || conv.contact?.phone_number;
                if (contactPhone) {
                    const formattedContactPhone = this.formatPhoneToE164(contactPhone);
                    return formattedContactPhone === formattedPhone;
                }
                return false;
            });

            if (conversation) {
                console.log(`✅ Conversación encontrada: ${conversation.id}`);
            } else {
                console.log(`ℹ️ No se encontró conversación existente para: ${formattedPhone}`);
            }

            return conversation || null;
        } catch (error: any) {
            console.error('❌ Error buscando conversación:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Procesar mensaje completo (crear contacto, conversación y enviar mensaje)
     */
    async processMessage(phoneNumber: string, message: string, userName?: string): Promise<boolean> {
        try {
            console.log(`📨 Procesando mensaje de ${phoneNumber}: ${message.substring(0, 50)}...`);
            
            // 1. Crear o encontrar contacto
            let contact = await this.findContactByPhone(phoneNumber);
            if (!contact) {
                contact = await this.createOrUpdateContact(phoneNumber, userName);
            }

            if (!contact) {
                console.error('❌ No se pudo crear/encontrar el contacto');
                return false;
            }

            // 2. Buscar conversación existente o crear nueva
            let conversation = await this.findConversationByPhone(phoneNumber);
            if (!conversation) {
                conversation = await this.createConversation(contact.id, phoneNumber);
            }

            if (!conversation) {
                console.error('❌ No se pudo crear/encontrar la conversación');
                return false;
            }

            // 3. Enviar mensaje entrante
            await this.sendIncomingMessage(conversation.id, message);

            console.log(`✅ Mensaje procesado exitosamente para ${phoneNumber}`);
            return true;
        } catch (error) {
            console.error('❌ Error procesando mensaje en Chatwoot:', error);
            return false;
        }
    }

    /**
     * Verificar la conexión con Chatwoot
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.getAccountInfo();
            console.log('✅ Conexión con Chatwoot exitosa');
            return true;
        } catch (error: any) {
            console.error('❌ Error conectando con Chatwoot:', error.response?.data || error.message);
            return false;
        }
    }
}

export default new ChatwootService();