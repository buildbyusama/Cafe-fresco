import React, { createContext, useState, useEffect, useCallback } from 'react';
import { setUnauthorizedHandler } from '../../api/client';

export const MainContext = createContext();

const MainProvider = ({ children }) => {
    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [distributer, setDistributer] = useState([]);
    const BASE_URL = import.meta.env.VITE_BASE_URL;
    const [adminRole, setAdminRole] = useState("");
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    // 'loading' | 'authenticated' | 'anonymous'
    const [sessionStatus, setSessionStatus] = useState("loading");

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${BASE_URL}/category/fetch`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",

            });

            if (response.ok) {
                const data = await response.json();
                setCategories(data.categories);
            } else {
                console.error('Failed to fetch categories');
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const clearSession = () => {
        setAdminName("");
        setAdminRole("");
        setAdminEmail("");
        setSessionStatus("anonymous");
    };

    // Session comes from the server (httpOnly cookie), never from reading the token in JS
    const refreshSession = useCallback(async () => {
        try {
            const response = await fetch(`${BASE_URL}/admin/me`, { credentials: "include" });
            if (response.status === 401 || response.status === 403) {
                clearSession();
                return null;
            }
            if (!response.ok) {
                // Server error: keep an existing session, don't log the user out
                setSessionStatus((s) => (s === 'loading' ? 'anonymous' : s));
                return null;
            }
            const data = await response.json();
            setAdminName(data.name || "");
            setAdminRole(data.role || "");
            setAdminEmail(data.email || "");
            setSessionStatus("authenticated");
            return data;
        } catch (error) {
            // Network error (backend down/restarting): keep an existing session
            console.error('Error loading session:', error);
            setSessionStatus((s) => (s === 'loading' ? 'anonymous' : s));
            return null;
        }
    }, [BASE_URL]);

    const logout = async () => {
        try {
            await fetch(`${BASE_URL}/admin/logout`, { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        clearSession();
    };

    const fetchDepartments = async () => {
        try {
            const response = await fetch(`${BASE_URL}/department/fetch`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: "include",

            });

            if (response.ok) {
                const data = await response.json();
                setDepartments(data.departments);
            } else {
                console.error('Failed to fetch Departments');
            }
        } catch (error) {
            console.error('Error fetching Departments:', error);
        }
    };

    const fetchDistributor = async () => {
        try {

            const response = await fetch(`${BASE_URL}/distributer/`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: "include"
            });

            if (!response.ok) {
                console.error('Failed to fetch distributors');
                return;
            }

            const data = await response.json();

            if (Array.isArray(data.distributors)) {
                setDistributer(data.distributors);
            } else {
                console.error('Unexpected data format:', data);
                setDistributer([]);
            }

        } catch (error) {
            console.error('Error fetching distributors:', error);
        }
    };


    useEffect(() => {
        if (BASE_URL) refreshSession();
        // Any API 401 ends the session; AdminRoute then redirects to login?next=<current page>
        setUnauthorizedHandler(() => clearSession());
        return () => setUnauthorizedHandler(null);
    }, [BASE_URL]);

    // Back on the tab: re-read the session so a role change or removal made by another admin shows
    // up without a reload (at most every 30 s)
    useEffect(() => {
        let last = Date.now();
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || Date.now() - last < 30000) return;
            last = Date.now();
            refreshSession();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [refreshSession]);

    // Shared lists need the admin session (departments/distributors are protected),
    // so load them once logged in and clear them on logout
    useEffect(() => {
        if (sessionStatus === 'authenticated') {
            fetchCategories();
            fetchDistributor();
            fetchDepartments();
        } else if (sessionStatus === 'anonymous') {
            setCategories([]);
            setDepartments([]);
            setDistributer([]);
        }
    }, [sessionStatus]);

    return (
        <MainContext.Provider value={{ categories, adminRole, adminName, adminEmail, sessionStatus, refreshSession, logout, fetchCategories, setAdminRole, setAdminName, fetchDepartments, departments, fetchDistributor, distributer }}>
            {children}
        </MainContext.Provider>
    );
};

export default MainProvider;
