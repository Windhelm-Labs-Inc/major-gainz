"""Chat proxy API endpoint for secure OpenAI integration."""

import os
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import httpx

from ..settings import logger

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user", "assistant", "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-4o"
    max_tokens: Optional[int] = 2000
    temperature: Optional[float] = 0.7
    portfolio_context: Optional[Dict[str, Any]] = None
    scratchpad_context: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    usage: Optional[Dict[str, Any]] = None


def get_openai_api_key() -> str:
    """Get OpenAI API key from environment variables."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="OpenAI API key not configured on server"
        )
    return api_key


@router.post("/completion", response_model=ChatResponse)
async def chat_completion(request: ChatRequest) -> ChatResponse:
    """
    Secure proxy for OpenAI chat completions.
    
    This endpoint handles OpenAI API calls on behalf of the frontend,
    keeping the API key secure on the backend only.
    """
    logger.info(f"Chat completion requested with {len(request.messages)} messages")
    
    try:
        api_key = get_openai_api_key()
        
        # Build system prompt with context
        system_message = build_system_prompt(request.portfolio_context, request.scratchpad_context)
        
        # Prepare messages for OpenAI
        openai_messages = []
        if system_message:
            openai_messages.append({
                "role": "system",
                "content": system_message
            })
        
        # Add user messages
        for msg in request.messages:
            openai_messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Call OpenAI API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": request.model,
                    "messages": openai_messages,
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature
                }
            )
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"OpenAI API error: {response.text}"
                )
            
            result = response.json()
            
            # Extract response
            message_content = result["choices"][0]["message"]["content"]
            usage = result.get("usage", {})
            
            logger.info(f"Chat completion successful, tokens used: {usage.get('total_tokens', 'unknown')}")
            
            return ChatResponse(
                message=message_content,
                usage=usage
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat completion: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


def build_system_prompt(portfolio_context: Optional[Dict[str, Any]], scratchpad_context: Optional[str]) -> str:
    """Build system prompt with portfolio and scratchpad context."""
    
    base_prompt = """You are an advanced AI assistant specializing in cryptocurrency portfolio analysis and Hedera network DeFi protocols. You have access to comprehensive portfolio data, market statistics, and DeFi position information.

Your expertise includes:
- Portfolio composition analysis and optimization recommendations
- Risk assessment across different cryptocurrency holdings
- DeFi protocol analysis (SaucerSwap, Bonzo Finance) 
- Market trend interpretation and technical analysis
- Hedera network ecosystem insights

Provide detailed, actionable insights based on the data provided. Be specific about numbers, percentages, and concrete recommendations."""

    context_parts = [base_prompt]
    
    if portfolio_context:
        context_parts.append(f"\n**Portfolio Context:**\n{format_portfolio_context(portfolio_context)}")
    
    if scratchpad_context:
        context_parts.append(f"\n**Current Session Context:**\n{scratchpad_context}")
        
    return "\n".join(context_parts)


def format_portfolio_context(portfolio: Dict[str, Any]) -> str:
    """Format portfolio data for system prompt."""
    if not portfolio:
        return "No portfolio data available."
    
    context = []
    
    if "holdings" in portfolio and portfolio["holdings"]:
        context.append(f"Portfolio Holdings ({len(portfolio['holdings'])} tokens):")
        for holding in portfolio["holdings"][:10]:  # Top 10 holdings
            symbol = holding.get("symbol", "Unknown")
            amount = holding.get("amount", 0)
            usd_value = holding.get("usd", 0)
            percentage = holding.get("percent", 0)
            context.append(f"- {symbol}: {amount:.4f} tokens (${usd_value:.2f}, {percentage:.1f}%)")
    
    if "totalUsd" in portfolio:
        context.append(f"\nTotal Portfolio Value: ${portfolio['totalUsd']:.2f}")
    
    return "\n".join(context)


@router.get("/health")
async def health_check():
    """Health check for chat service."""
    try:
        # Check if OpenAI API key is configured
        api_key = os.getenv("OPENAI_API_KEY")
        has_api_key = bool(api_key and api_key != "PLACEHOLDER_FOR_BACKEND_INTEGRATION")
        
        return {
            "status": "healthy",
            "openai_configured": has_api_key,
            "timestamp": "2024-01-01T00:00:00Z"  # Could use actual timestamp
        }
    except Exception as e:
        logger.error(f"Chat health check failed: {e}")
        return {
            "status": "unhealthy", 
            "error": str(e),
            "openai_configured": False
        }