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
        this.accountId = '1'; // Por defecto, pero se puede obtener dinámicamente
        
        if (!this.baseURL || !this.apiToken || !this.inboxIdentifier) {
            console.error('❌ Variables de Chatwoot no configuradas correctamente');
        }
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
            console.log(`🔑 Con headers:`, this.getHeaders());
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/profile`,
                { headers: this.getHeaders() }
            );
            
            console.log(`📋 Respuesta completa del perfil:`, JSON.stringify(response.data, null, 2));
            
            // Obtener el account_id desde la respuesta
            if (response.data && response.data.accounts && response.data.accounts.length > 0) {
                this.accountId = response.data.accounts[0].id.toString();
                console.log(`✅ Account ID obtenido: ${this.accountId}`);
            } else {
                console.warn(`⚠️ No se encontraron cuentas en la respuesta`);
            }
            
            return response.data;
        } catch (error: any) {
            console.error('❌ Error completo obteniendo info de cuenta:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                url: `${this.baseURL}/api/v1/profile`
            });
            throw error;
        }
    }

    /**
     * Crear o actualizar un contacto en Chatwoot
     */
    async createOrUpdateContact(phoneNumber: string, name?: string): Promise<any> {
        try {
            console.log(`🔍 Intentando crear contacto para: ${phoneNumber}`);
            
            const contactData: ChatwootContact = {
                identifier: phoneNumber,
                name: name || phoneNumber,
                phone_number: phoneNumber
            };

            console.log(`📤 Datos del contacto:`, JSON.stringify(contactData, null, 2));
            console.log(`🌐 URL: ${this.baseURL}/api/v1/accounts/${this.accountId}/contacts`);
            console.log(`🔑 Headers:`, this.getHeaders());

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts`,
                contactData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Contacto creado exitosamente:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error(`❌ Error completo:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });
            
            if (error.response?.status === 422) {
                console.log(`🔍 Contacto ya existe, buscando...`);
                return await this.findContactByPhone(phoneNumber);
            }
            throw error;
        }
    }

    /**
     * Buscar contacto por número de teléfono
     */
    async findContactByPhone(phoneNumber: string): Promise<any> {
        try {
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/contacts/search?q=${phoneNumber}`,
                { headers: this.getHeaders() }
            );

            const contacts = response.data.payload;
            if (contacts && contacts.length > 0) {
                return contacts[0];
            }
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
            console.log(`🔍 Creando conversación para contacto ID: ${contactId}, teléfono: ${phoneNumber}`);
            console.log(`📋 Inbox ID: ${this.inboxIdentifier} (tipo: ${typeof this.inboxIdentifier})`);
            
            const conversationData = {
                source_id: phoneNumber,
                inbox_id: this.inboxIdentifier, // NO usar parseInt, mantener como string
                contact_id: contactId
            };

            console.log(`📤 Datos de conversación:`, JSON.stringify(conversationData, null, 2));
            console.log(`🌐 URL: ${this.baseURL}/api/v1/accounts/${this.accountId}/conversations`);

            const response = await axios.post(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations`,
                conversationData,
                { headers: this.getHeaders() }
            );

            console.log(`✅ Conversación creada exitosamente:`, response.data);
            return response.data;
        } catch (error: any) {
            console.error('❌ Error completo creando conversación:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message,
                requestData: {
                    source_id: phoneNumber,
                    inbox_id: this.inboxIdentifier,
                    contact_id: contactId
                }
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

            console.log(`✅ Mensaje entrante enviado a Chatwoot`);
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
            console.log(`🔍 Buscando conversación para: ${phoneNumber} en inbox: ${this.inboxIdentifier}`);
            
            const response = await axios.get(
                `${this.baseURL}/api/v1/accounts/${this.accountId}/conversations?status=open&inbox_id=${this.inboxIdentifier}`,
                { headers: this.getHeaders() }
            );

            console.log(`📋 Respuesta de búsqueda de conversaciones:`, JSON.stringify(response.data, null, 2));

            const conversations = response.data.data?.payload || [];
            const conversation = conversations.find((conv: any) => 
                conv.meta?.sender?.phone_number === phoneNumber ||
                conv.meta?.sender?.identifier === phoneNumber ||
                conv.contact?.phone_number === phoneNumber ||
                conv.contact?.identifier === phoneNumber
            );

            if (conversation) {
                console.log(`✅ Conversación encontrada:`, conversation.id);
            } else {
                console.log(`ℹ️ No se encontró conversación existente para: ${phoneNumber}`);
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