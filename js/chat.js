import { supabase } from "./supabase-config.js";

let currentUser = null;
let currentProfile = null;
let activeConversationId = null;
let messageChannel = null;

const conversationList = document.getElementById("conversation-list");
const messageList = document.getElementById("message-list");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const chatHeader = document.getElementById("chat-header-name");
const emptyState = document.getElementById("empty-state");
const chatPanel = document.getElementById("chat-panel");
const myUsernameEl = document.getElementById("my-username");
const logoutBtn = document.getElementById("logout-btn");
const newChatBtn = document.getElementById("new-chat-btn");
const newChatModal = document.getElementById("new-chat-modal");
const newChatForm = document.getElementById("new-chat-form");
const closeModalBtn = document.getElementById("close-modal-btn");
const userSearchInput = document.getElementById("user-search");
const userSearchResults = document.getElementById("user-search-results");
const selectedUsersEl = document.getElementById("selected-users");
const groupNameField = document.getElementById("group-name-field");
const newChatError = document.getElementById("new-chat-error");

let selectedUserIds = new Map(); // id -> username

// ---------- Arranque ----------
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();
  currentProfile = profile;
  myUsernameEl.textContent = profile?.username ?? currentUser.email;

  await loadConversations();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.location.href = "index.html";
      return;
    }
    // Mantiene currentUser sincronizado con la sesión real, por si
    // otra pestaña del mismo navegador cambia de usuario.
    if (session?.user) currentUser = session.user;
  });
}

// Devuelve el id de usuario tomando la sesión más fresca posible,
// para nunca mandar un created_by/sender_id desincronizado.
async function getFreshUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) currentUser = session.user;
  return currentUser?.id;
}

// ---------- Cerrar sesión ----------
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

// ---------- Cargar lista de conversaciones ----------
async function loadConversations() {
  const { data: participantRows, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", currentUser.id);

  if (error || !participantRows?.length) {
    conversationList.innerHTML = `<li class="conversation-list__empty">Aún no tienes conversaciones.</li>`;
    return;
  }

  const conversationIds = participantRows.map((r) => r.conversation_id);

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, is_group, name, conversation_participants(user_id, profiles(id, username))")
    .in("id", conversationIds)
    .order("created_at", { ascending: false });

  conversationList.innerHTML = "";
  for (const conv of conversations ?? []) {
    const others = conv.conversation_participants
      .map((p) => p.profiles)
      .filter((p) => p && p.id !== currentUser.id);

    const label = conv.is_group
      ? conv.name || others.map((o) => o.username).join(", ")
      : others[0]?.username ?? "Conversación";

    const li = document.createElement("li");
    li.className = "conversation-item";
    li.dataset.id = conv.id;
    li.innerHTML = `
      <span class="conversation-item__avatar">${label.charAt(0).toUpperCase()}</span>
      <span class="conversation-item__name">${label}</span>
    `;
    li.addEventListener("click", () => openConversation(conv.id, label));
    conversationList.appendChild(li);
  }
}

// ---------- Abrir conversación ----------
async function openConversation(conversationId, label) {
  activeConversationId = conversationId;
  chatHeader.textContent = label;
  emptyState.classList.add("hidden");
  chatPanel.classList.remove("hidden");

  document.querySelectorAll(".conversation-item").forEach((el) => {
    el.classList.toggle("conversation-item--active", el.dataset.id === conversationId);
  });

  await loadMessages(conversationId);
  subscribeToMessages(conversationId);
}

// ---------- Cargar mensajes ----------
async function loadMessages(conversationId) {
  const { data: messages } = await supabase
    .from("messages")
    .select("id, content, created_at, sender_id, profiles(username)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  messageList.innerHTML = "";
  for (const msg of messages ?? []) {
    renderMessage(msg);
  }
  messageList.scrollTop = messageList.scrollHeight;
}

function renderMessage(msg) {
  const mine = msg.sender_id === currentUser.id;
  const li = document.createElement("li");
  li.className = `message-bubble ${mine ? "message-bubble--mine" : ""}`;
  const time = new Date(msg.created_at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  li.innerHTML = `
    ${!mine ? `<span class="message-bubble__author">${msg.profiles?.username ?? ""}</span>` : ""}
    <p class="message-bubble__text"></p>
    <span class="message-bubble__time">${time}</span>
  `;
  li.querySelector(".message-bubble__text").textContent = msg.content;
  messageList.appendChild(li);
}

// ---------- Suscripción en tiempo real ----------
function subscribeToMessages(conversationId) {
  if (messageChannel) supabase.removeChannel(messageChannel);

  messageChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", payload.new.sender_id)
          .single();
        renderMessage({ ...payload.new, profiles: profile });
        messageList.scrollTop = messageList.scrollHeight;
      }
    )
    .subscribe();
}

// ---------- Enviar mensaje ----------
messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  if (!content || !activeConversationId) return;

  messageInput.value = "";
  const myId = await getFreshUserId();
  const { error } = await supabase.from("messages").insert({
    conversation_id: activeConversationId,
    sender_id: myId,
    content,
  });
  if (error) console.error("Error al enviar mensaje:", error.message);
});

// ---------- Modal: nueva conversación ----------
newChatBtn.addEventListener("click", () => {
  newChatModal.classList.remove("hidden");
});

closeModalBtn.addEventListener("click", closeModal);

function closeModal() {
  newChatModal.classList.add("hidden");
  selectedUserIds.clear();
  renderSelectedUsers();
  userSearchInput.value = "";
  userSearchResults.innerHTML = "";
  hideNewChatError();
}

function showNewChatError(message) {
  newChatError.textContent = message;
  newChatError.classList.remove("hidden");
}

function hideNewChatError() {
  newChatError.classList.add("hidden");
  newChatError.textContent = "";
}

let searchTimeout;
userSearchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(searchUsers, 250);
});

async function searchUsers() {
  const query = userSearchInput.value.trim();
  if (!query) {
    userSearchResults.innerHTML = "";
    return;
  }
  const { data: users } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", `%${query}%`)
    .neq("id", currentUser.id)
    .limit(8);

  userSearchResults.innerHTML = "";
  const results = (users ?? []).filter((u) => !selectedUserIds.has(u.id));

  if (results.length === 0) {
    const li = document.createElement("li");
    li.className = "conversation-list__empty";
    li.textContent = "Nadie con ese apodo ha entrado todavía.";
    userSearchResults.appendChild(li);
    return;
  }

  for (const user of results) {
    const li = document.createElement("li");
    li.className = "user-result";
    li.textContent = user.username;
    li.addEventListener("click", () => {
      selectedUserIds.set(user.id, user.username);
      renderSelectedUsers();
      userSearchInput.value = "";
      userSearchResults.innerHTML = "";
      hideNewChatError();
    });
    userSearchResults.appendChild(li);
  }
}

function renderSelectedUsers() {
  selectedUsersEl.innerHTML = "";
  selectedUserIds.forEach((username, id) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = username;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      selectedUserIds.delete(id);
      renderSelectedUsers();
    });
    chip.appendChild(remove);
    selectedUsersEl.appendChild(chip);
  });
  groupNameField.classList.toggle("hidden", selectedUserIds.size < 2);
}

newChatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideNewChatError();

  if (selectedUserIds.size === 0) {
    return showNewChatError("Busca y selecciona al menos un usuario de la lista antes de crear la conversación.");
  }

  const isGroup = selectedUserIds.size >= 2;
  const groupName = document.getElementById("group-name-input").value.trim();
  const myId = await getFreshUserId();

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .insert({ is_group: isGroup, name: isGroup ? groupName || null : null, created_by: myId })
    .select()
    .single();

  if (convError) return showNewChatError("No se pudo crear la conversación: " + convError.message);

  const participants = [myId, ...selectedUserIds.keys()].map((user_id) => ({
    conversation_id: conversation.id,
    user_id,
  }));

  const { error: partError } = await supabase.from("conversation_participants").insert(participants);
  if (partError) return showNewChatError("No se pudo agregar a los participantes: " + partError.message);

  closeModal();
  await loadConversations();
  const label = isGroup ? groupName || [...selectedUserIds.values()].join(", ") : [...selectedUserIds.values()][0];
  openConversation(conversation.id, label);
});

init();