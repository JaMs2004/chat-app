import { supabase } from "./supabase-config.js";

const nicknameForm = document.getElementById("nickname-form");
const nicknameInput = document.getElementById("nickname-input");
const errorBox = document.getElementById("auth-error");

// Si ya hay sesión activa, ir directo al chat
supabase.auth.getSession().then(({ data }) => {
  if (data.session) window.location.href = "chat.html";
});

function showMessage(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearMessage() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

nicknameForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const nickname = nicknameInput.value.trim();
  if (nickname.length < 2) {
    return showMessage("El apodo debe tener al menos 2 caracteres.");
  }

  const submitBtn = nicknameForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  submitBtn.textContent = "Entrando...";

  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { username: nickname } },
  });

  if (error) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Entrar a la sala";
    return showMessage(traducirError(error.message));
  }

  window.location.href = "chat.html";
});

function traducirError(msg) {
  if (msg.includes("Anonymous sign-ins are disabled")) {
    return "Falta activar 'Anonymous Sign-Ins' en Supabase (Authentication → Providers).";
  }
  return msg;
}